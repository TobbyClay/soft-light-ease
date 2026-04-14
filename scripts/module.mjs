const MODULE_ID = "soft-light-ease";
const TAB_ID = "easing";
const DEFAULT_CURVE = "smoother";
const DEFAULT_EASE = 0.5;
const INNER_WIDTH_SCALE = 0.35;

const FLAG_KEYS = Object.freeze({
  enabled: "enabled",
  inner: "innerEase",
  outer: "outerEase",
  curve: "curve"
});

const DATA_KEYS = Object.freeze({
  enabled: "softEaseEnabled",
  inner: "softEaseInner",
  outer: "softEaseOuter",
  curve: "softEaseCurve"
});

const CURVES = Object.freeze({
  linear: 0,
  smooth: 1,
  smoother: 2,
  cosine: 3
});

const CURVE_OPTIONS = Object.freeze({
  linear: "SOFTLIGHTEASE.Curves.linear",
  smooth: "SOFTLIGHTEASE.Curves.smooth",
  smoother: "SOFTLIGHTEASE.Curves.smoother",
  cosine: "SOFTLIGHTEASE.Curves.cosine"
});

const SHADER_CACHE = {
  background: new WeakMap(),
  coloration: new WeakMap(),
  illumination: new WeakMap()
};

let sourcePatched = false;

Hooks.once("init", () => {
  patchAmbientLightSources();
});

Hooks.on("renderAmbientLightConfig", (app, element) => {
  void injectAmbientLightEaseTab(app, element).catch(error => {
    console.error(`${MODULE_ID} | Failed to inject Ambient Light tab`, error);
  });
});

function patchAmbientLightSources() {
  if ( sourcePatched ) return;

  const LightSourceClass = CONFIG?.Canvas?.lightSourceClass;
  const BaseLightSource = foundry?.canvas?.sources?.BaseLightSource;
  if ( !LightSourceClass || !BaseLightSource ) return;

  for ( const [key, value] of Object.entries({
    [DATA_KEYS.enabled]: false,
    [DATA_KEYS.inner]: 0,
    [DATA_KEYS.outer]: 0,
    [DATA_KEYS.curve]: CURVES[DEFAULT_CURVE]
  }) ) {
    if ( !(key in LightSourceClass.defaultData) ) LightSourceClass.defaultData[key] = value;
  }

  LightSourceClass._initializeShaderKeys = Array.from(new Set([
    ...LightSourceClass._initializeShaderKeys,
    DATA_KEYS.enabled,
    DATA_KEYS.inner,
    DATA_KEYS.outer,
    DATA_KEYS.curve
  ]));

  wrapMethod(LightSourceClass.prototype, "_initialize", function(original, data) {
    original.call(this, data);
    const easeConfig = getAmbientLightEaseConfig(this.object?.document);
    this.data[DATA_KEYS.enabled] = Boolean(easeConfig);
    this.data[DATA_KEYS.inner] = easeConfig?.innerEase ?? 0;
    this.data[DATA_KEYS.outer] = easeConfig?.outerEase ?? 0;
    this.data[DATA_KEYS.curve] = easeConfig ? CURVES[easeConfig.curve] : CURVES[DEFAULT_CURVE];
  });

  wrapMethod(BaseLightSource.prototype, "_configureShaders", function(original, ...args) {
    const shaders = original.call(this, ...args);
    if ( !this.data?.[DATA_KEYS.enabled] || !isAmbientLightObject(this.object) ) return shaders;

    for ( const layerId of Object.keys(shaders) ) {
      shaders[layerId] = getWrappedShaderClass(shaders[layerId], layerId);
    }

    return shaders;
  });

  wrapMethod(BaseLightSource.prototype, "_updateCommonUniforms", function(original, shader, ...args) {
    original.call(this, shader, ...args);
    if ( !this.data?.[DATA_KEYS.enabled] ) return;
    if ( !shader?.uniforms || !("softEaseInner" in shader.uniforms) ) return;

    shader.uniforms.softEaseInner = this.data[DATA_KEYS.inner];
    shader.uniforms.softEaseOuter = this.data[DATA_KEYS.outer];
    shader.uniforms.softEaseCurve = this.data[DATA_KEYS.curve];
  });

  sourcePatched = true;
}

async function injectAmbientLightEaseTab(app, element) {
  const content = element?.querySelector?.(".window-content") ?? element;
  if ( !content ) return;

  const nav = content.querySelector(".sheet-tabs.tabs");
  const advancedNav = nav?.querySelector('[data-action="tab"][data-group="sheet"][data-tab="advanced"]');
  const advancedSection = content.querySelector('.tab[data-group="sheet"][data-tab="advanced"]');
  if ( !nav || !advancedNav || !advancedSection ) return;

  content.querySelector('[data-soft-light-ease="tab"]')?.remove();
  content.querySelector('[data-soft-light-ease="section"]')?.remove();

  const tab = document.createElement("a");
  tab.dataset.action = "tab";
  tab.dataset.group = "sheet";
  tab.dataset.tab = TAB_ID;
  tab.dataset.softLightEase = "tab";
  if ( app.tabGroups?.sheet === TAB_ID ) tab.classList.add("active");
  tab.innerHTML = `<i class="fa-solid fa-wave-square" inert></i><span>${game.i18n.localize("SOFTLIGHTEASE.Tabs.easing")}</span>`;
  advancedNav.insertAdjacentElement("afterend", tab);

  const tabsContext = {
    easing: {
      group: "sheet",
      cssClass: app.tabGroups?.sheet === TAB_ID ? "active" : ""
    }
  };

  const html = buildEaseSectionHtml({
    tabs: tabsContext,
    lightEase: getAmbientLightEaseContext(app._preview ?? app.document)
  });

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const section = wrapper.firstElementChild;
  if ( !section ) return;
  section.dataset.softLightEase = "section";
  advancedSection.insertAdjacentElement("afterend", section);
}

function buildEaseSectionHtml(context) {
  const tabClass = ["tab", "standard-form", "scrollable", context.tabs.easing.cssClass].filter(Boolean).join(" ");
  const { lightEase } = context;
  const unavailableMarkup = `
<p class="hint unavailable-note">
  <i class="fa-solid fa-triangle-exclamation"></i>
  ${escapeHtml(localize("SOFTLIGHTEASE.Unavailable"))}
</p>`;

  const availableMarkup = `
<div class="form-group">
  <label>${escapeHtml(localize("SOFTLIGHTEASE.Fields.enabled.label"))}</label>
  <div class="form-fields checkbox-row">
    <input type="checkbox" name="flags.soft-light-ease.enabled" data-dtype="Boolean"${formatCheckedAttribute(lightEase.enabled)}>
  </div>
  <p class="hint">${escapeHtml(localize("SOFTLIGHTEASE.Fields.enabled.hint"))}</p>
</div>

<div class="form-group">
  <label>${escapeHtml(localize("SOFTLIGHTEASE.Fields.inner.label"))}</label>
  <div class="form-fields">
    <input type="number" name="flags.soft-light-ease.innerEase" value="${escapeHtml(String(lightEase.innerEase))}"
      min="0" max="1" step="0.05" data-dtype="Number" inputmode="decimal">
  </div>
  <p class="hint">${escapeHtml(game.i18n.format("SOFTLIGHTEASE.Fields.inner.hint", { ease: lightEase.fallbackEase }))}</p>
</div>

<div class="form-group">
  <label>${escapeHtml(localize("SOFTLIGHTEASE.Fields.outer.label"))}</label>
  <div class="form-fields">
    <input type="number" name="flags.soft-light-ease.outerEase" value="${escapeHtml(String(lightEase.outerEase))}"
      min="0" max="1" step="0.05" data-dtype="Number" inputmode="decimal">
  </div>
  <p class="hint">${escapeHtml(game.i18n.format("SOFTLIGHTEASE.Fields.outer.hint", { ease: lightEase.fallbackEase }))}</p>
</div>

<div class="form-group">
  <label>${escapeHtml(localize("SOFTLIGHTEASE.Fields.curve.label"))}</label>
  <div class="form-fields">
    <select name="flags.soft-light-ease.curve" data-dtype="String">
      ${renderCurveOptions(lightEase.curve)}
    </select>
  </div>
  <p class="hint">${escapeHtml(localize("SOFTLIGHTEASE.Fields.curve.hint"))}</p>
</div>

<p class="hint module-note">${escapeHtml(localize("SOFTLIGHTEASE.Note"))}</p>`;

  return `<section class="${escapeHtml(tabClass)}" data-tab="${TAB_ID}" data-group="${escapeHtml(context.tabs.easing.group)}">
  <fieldset class="soft-light-ease-tab">
    <legend>${escapeHtml(localize("SOFTLIGHTEASE.Tabs.easing"))}</legend>
    ${lightEase.available ? availableMarkup : unavailableMarkup}
  </fieldset>
</section>`;
}

function renderCurveOptions(selectedCurve) {
  return Object.entries(CURVE_OPTIONS).map(([curve, label]) => {
    const selected = curve === selectedCurve ? " selected" : "";
    return `<option value="${escapeHtml(curve)}"${selected}>${escapeHtml(localize(label))}</option>`;
  }).join("");
}

function formatCheckedAttribute(checked) {
  return checked ? " checked" : "";
}

function localize(key) {
  return game.i18n.localize(key);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function getAmbientLightEaseContext(document) {
  const attenuation = clampEase(document?.config?.attenuation, DEFAULT_EASE);
  const flags = getAmbientLightFlags(document);

  return {
    available: !document?.config?.negative,
    enabled: Boolean(flags[FLAG_KEYS.enabled]),
    innerEase: clampEase(flags[FLAG_KEYS.inner], attenuation),
    outerEase: clampEase(flags[FLAG_KEYS.outer], attenuation),
    curve: normalizeCurve(flags[FLAG_KEYS.curve]),
    curveOptions: CURVE_OPTIONS,
    fallbackEase: attenuation.toFixed(2)
  };
}

function getAmbientLightEaseConfig(document) {
  if ( !isAmbientLightDocument(document) || document.config?.negative ) return null;

  const flags = getAmbientLightFlags(document);
  if ( !flags[FLAG_KEYS.enabled] ) return null;

  const attenuation = clampEase(document.config?.attenuation, DEFAULT_EASE);
  return {
    innerEase: clampEase(flags[FLAG_KEYS.inner], attenuation),
    outerEase: clampEase(flags[FLAG_KEYS.outer], attenuation),
    curve: normalizeCurve(flags[FLAG_KEYS.curve])
  };
}

function getAmbientLightFlags(document) {
  if ( !isAmbientLightDocument(document) ) return {};
  return document.flags?.[MODULE_ID] ?? document._source?.flags?.[MODULE_ID] ?? {};
}

function isAmbientLightDocument(document) {
  return document?.documentName === "AmbientLight";
}

function isAmbientLightObject(object) {
  return isAmbientLightDocument(object?.document);
}

function clampEase(value, fallback) {
  const number = Number(value);
  if ( Number.isFinite(number) ) return Math.min(Math.max(number, 0), 1);
  return fallback;
}

function normalizeCurve(value) {
  return Object.hasOwn(CURVES, value) ? value : DEFAULT_CURVE;
}

function wrapMethod(target, methodName, wrapper) {
  const original = target?.[methodName];
  if ( typeof original !== "function" || original.__softLightEaseWrapped ) return;

  const wrapped = function(...args) {
    return wrapper.call(this, original, ...args);
  };

  Object.defineProperty(wrapped, "__softLightEaseWrapped", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  target[methodName] = wrapped;
}

function getWrappedShaderClass(baseClass, layerId) {
  const cache = SHADER_CACHE[layerId];
  if ( cache.has(baseClass) ) return cache.get(baseClass);

  const exposureChunk = getExposureChunk(layerId);

  class SoftLightEaseShader extends baseClass {
    static get FRAGMENT_UNIFORMS() {
      return `${super.FRAGMENT_UNIFORMS}
  uniform float softEaseInner;
  uniform float softEaseOuter;
  uniform float softEaseCurve;
  `;
    }

    static get FRAGMENT_FUNCTIONS() {
      return `${super.FRAGMENT_FUNCTIONS}
  float sleApplyCurve(in float t) {
    t = clamp(t, 0.0, 1.0);
    if ( softEaseCurve < 0.5 ) return t;
    if ( softEaseCurve < 1.5 ) return t * t * (3.0 - (2.0 * t));
    if ( softEaseCurve < 2.5 ) return t * t * t * (t * ((t * 6.0) - 15.0) + 10.0);
    return 0.5 - (0.5 * cos(3.141592653589793 * t));
  }

  float sleInnerTransition(in float dist) {
    float width = softEaseInner * ${INNER_WIDTH_SCALE.toFixed(2)};
    float lowerEdge = clamp(ratio - width, 0.0, 1.0);
    float upperEdge = clamp(ratio + width, 0.0, 1.0);
    float span = max(upperEdge - lowerEdge, 0.0001);
    float t = (dist - lowerEdge) / span;
    return sleApplyCurve(t);
  }

  float sleOuterFade(in float dist) {
    if ( softEaseOuter <= 0.0 ) return dist < 1.0 ? 1.0 : 0.0;
    float start = clamp(1.0 - softEaseOuter, 0.0, 1.0);
    float span = max(1.0 - start, 0.0001);
    float t = (dist - start) / span;
    return 1.0 - sleApplyCurve(t);
  }
  `;
    }

    static get SHADER_HEADER() {
      return `
  ${this.FRAGMENT_UNIFORMS}
  ${this.VERTEX_FRAGMENT_VARYINGS}
  ${this.FRAGMENT_FUNCTIONS}
  ${this.CONSTANTS}
  ${this.SWITCH_COLOR}
  `;
    }

    static get SWITCH_COLOR() {
      return `
    vec3 switchColor( in vec3 innerColor, in vec3 outerColor, in float dist ) {
      return mix(innerColor, outerColor, sleInnerTransition(dist));
    }`;
    }

    static get FALLOFF() {
      return `
  depth *= sleOuterFade(dist);
  `;
    }

    static get EXPOSURE() {
      return exposureChunk ?? super.EXPOSURE;
    }

    static get defaultUniforms() {
      return {
        ...super.defaultUniforms,
        softEaseInner: 0,
        softEaseOuter: 0,
        softEaseCurve: CURVES[DEFAULT_CURVE]
      };
    }
  }

  cache.set(baseClass, SoftLightEaseShader);
  return SoftLightEaseShader;
}

function getExposureChunk(layerId) {
  if ( layerId === "background" ) {
    return `
    // Computing exposure for softened inner transition
    if ( exposure > 0.0 ) {
      float halfExposure = exposure * 0.5;
      float finalExposure = halfExposure * (1.0 - sleInnerTransition(dist)) + halfExposure;
      changedColor *= (1.0 + finalExposure);
    }
    `;
  }

  if ( layerId === "illumination" ) {
    return `
    // Computing exposure with illumination for softened inner transition
    if ( exposure > 0.0 ) {
      float quartExposure = exposure * 0.25;
      float finalExposure = quartExposure * (1.0 - sleInnerTransition(dist)) + quartExposure;
      changedColor *= (1.0 + finalExposure);
    }
    else if ( exposure != 0.0 ) changedColor *= (1.0 + exposure);
    `;
  }

  return null;
}
