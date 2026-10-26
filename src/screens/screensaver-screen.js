import { LitElement, html, css } from 'lit';

export class FamilyHubScreensaverScreen extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
  };

  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 100;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      cursor: pointer;
    }
    .container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .card-slot {
      width: 100%;
      height: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-slot > * {
      width: 100% !important;
      height: 100% !important;
      flex: 1 !important;
      display: block !important;
    }
  `;

  firstUpdated() {
    this._mountCard();
  }

  updated(changedProperties) {
    if (changedProperties.has('hass') && this._cardEl) {
      this._cardEl.hass = this.hass;
    }
    if (changedProperties.has('config') && this._cardEl) {
      this._updateCardConfig();
    }
  }

  _cardConfig() {
    const rawCard = this.config?.card || {
      type: 'custom:album-slideshow-card',
      entity: this.config?.entity || 'camera.album_slideshow_wedding_highlights',
    };
    return {
      fit: 'cover',
      ...rawCard,
      aspect_ratio: rawCard.aspect_ratio || 'auto',
    };
  }

  async _mountCard() {
    const slot = this.renderRoot?.querySelector('.card-slot');
    if (!slot) return;
    slot.innerHTML = '';

    const cardCfg = this._cardConfig();
    const tag = cardCfg.type.startsWith('custom:')
      ? cardCfg.type.slice(7)
      : `hui-${cardCfg.type}-card`;

    // Ensure the custom element is registered, or dynamically load album-slideshow-card if needed
    if (typeof customElements !== 'undefined') {
      if (!customElements.get(tag) && tag === 'album-slideshow-card') {
        try {
          const dynamicImport = new Function('url', 'return import(url)');
          await dynamicImport('/album_slideshow_static/album-slideshow-card.js');
        } catch {
          // ignore
        }
      }
    }

    let el;
    try {
      el = document.createElement(tag);
      if (typeof el.setConfig === 'function') {
        el.setConfig(cardCfg);
      }
      el.hass = this.hass;
    } catch (err) {
      console.warn('family-hub-screensaver: failed to create card element', err);
      el = document.createElement('div');
      el.textContent = 'Album Slideshow unavailable';
    }

    // Ensure inner styles stretch full-height without margins or rounded corners
    const applyInnerStyles = () => {
      try {
        if (el.shadowRoot && !el.shadowRoot.querySelector('#fh-ss-style')) {
          const style = document.createElement('style');
          style.id = 'fh-ss-style';
          style.textContent = `
            :host { height: 100% !important; width: 100% !important; display: block !important; }
            ha-card { height: 100% !important; width: 100% !important; border-radius: 0 !important; border: none !important; aspect-ratio: auto !important; }
            .stage { height: 100% !important; width: 100% !important; border-radius: 0 !important; }
          `;
          el.shadowRoot.appendChild(style);
        }
      } catch (e) {
        // ignore
      }
    };

    applyInnerStyles();
    requestAnimationFrame(applyInnerStyles);
    setTimeout(applyInnerStyles, 200);

    this._cardEl = el;
    slot.appendChild(el);
  }

  _updateCardConfig() {
    try {
      if (this._cardEl && typeof this._cardEl.setConfig === 'function') {
        this._cardEl.setConfig(this._cardConfig());
      }
    } catch (e) {
      console.error(e);
    }
  }

  _handleClick(_e) {
    // Interacting with the screen dismisses screensaver and wakes the hub
    this.dispatchEvent(new CustomEvent('screensaver-dismiss', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="container" @pointerdown=${this._handleClick}>
        <div class="card-slot"></div>
      </div>
    `;
  }
}

customElements.define('family-hub-screensaver-screen', FamilyHubScreensaverScreen);
