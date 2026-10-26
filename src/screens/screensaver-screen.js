import { LitElement, html, css } from 'lit';

export class FamilyHubScreensaverScreen extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    _dimmingFilter: { state: true },
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
      transition: filter 1s ease-in-out;
    }
    .card-slot > * {
      width: 100% !important;
      height: 100% !important;
      flex: 1 !important;
      display: block !important;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._updateDimmingFilter();
    this._dimmingInterval = setInterval(() => this._updateDimmingFilter(), 60000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._dimmingInterval) {
      clearInterval(this._dimmingInterval);
      this._dimmingInterval = null;
    }
  }

  _getDimmingFilter() {
    const dimCfg = this.config?.dimming || {};
    const dayBrightness = dimCfg.day ?? 0.85;
    const eveningBrightness = dimCfg.evening ?? 0.60;
    const nightBrightness = dimCfg.night ?? 0.30;
    const nightFilterEnabled = dimCfg.night_filter !== false;

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;

    // Day: 06:30 to 18:00 (6:30 AM to 6:00 PM)
    if (hour >= 6.5 && hour < 18.0) {
      return `brightness(${dayBrightness})`;
    }
    // Evening: 18:00 to 22:00 (6:00 PM to 10:00 PM)
    if (hour >= 18.0 && hour < 22.0) {
      return `brightness(${eveningBrightness}) sepia(0.12)`;
    }
    // Night: 22:00 to 06:30 (10:00 PM to 6:30 AM)
    return nightFilterEnabled
      ? `brightness(${nightBrightness}) sepia(0.4) saturate(1.25) hue-rotate(-15deg)`
      : `brightness(${nightBrightness})`;
  }

  _updateDimmingFilter() {
    this._dimmingFilter = this._getDimmingFilter();
  }

  firstUpdated() {
    this._mountCard();
  }

  updated(changedProperties) {
    if (changedProperties.has('hass') && this._cardEl) {
      this._cardEl.hass = this.hass;
    }
    if (changedProperties.has('config')) {
      this._updateDimmingFilter();
      if (this._cardEl) {
        this._updateCardConfig();
      }
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
        <div class="card-slot" style="filter: ${this._dimmingFilter || this._getDimmingFilter()};"></div>
      </div>
    `;
  }
}

customElements.define('family-hub-screensaver-screen', FamilyHubScreensaverScreen);
