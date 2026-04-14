# Soft Light Ease

`Soft Light Ease` is a Foundry Virtual Tabletop v14 module that softens the transition between bright light, dim light, and darkness for ambient lights.

Foundry already provides attenuation, but the default result still reads as a fairly hard boundary in many scenes. This module adds a dedicated `Light Ease` tab to the Ambient Light configuration sheet so each light can use a broader, smoother falloff.

## Features

- Adds a `Light Ease` tab beside the built-in Ambient Light tabs
- Per-light enable toggle
- Separate controls for:
  - `Bright to Dim Ease`
  - `Dim to Dark Ease`
  - `Easing Curve`
- Preserves Foundry's existing light animation selection
- Applies only to regular ambient lights

## Compatibility

- Foundry Virtual Tabletop v14
- Verified against `14.359`

## Installation

Install the module into your Foundry `Data/modules` directory as `soft-light-ease`.

Example path on Windows:

```text
C:\Users\<you>\AppData\Local\FoundryVTT\Data\modules\soft-light-ease
```

The module directory should contain at least:

```text
module.json
scripts/module.mjs
styles/module.css
languages/en.json
```

## Usage

1. Enable the module in your world.
2. Open an Ambient Light configuration sheet.
3. Click the new `Light Ease` tab in the top tab bar.
4. Enable `Light Ease`.
5. Adjust the settings:

- `Bright to Dim Ease`
  Controls how broadly the bright area blends into dim light.

- `Dim to Dark Ease`
  Controls how early the dim area fades down into darkness.

- `Easing Curve`
  Chooses the interpolation style used for both transitions.

## Recommended Starting Values

These are practical starting points, not strict rules:

- `Bright to Dim Ease`: `0.40` to `0.65`
- `Dim to Dark Ease`: `0.40` to `0.75`
- `Easing Curve`: `Smootherstep`

If the light feels too flat, lower one or both ease values. If the edge still looks too abrupt, raise them gradually.

## What It Does Internally

The module patches Foundry's ambient light source setup and wraps the active lighting shader classes so it can:

- soften the inner bright-to-dim transition
- soften the outer dim-to-dark falloff
- keep the currently selected light animation behavior intact

The configuration is stored per ambient light as document flags under:

```text
flags.soft-light-ease
```

## Limitations

- Ambient Light sheets only
- Token-emitted lights are not configured by this module
- Darkness sources are intentionally excluded
- The exact visual result still depends on scene darkness, coloration, luminosity, and animation settings

## Troubleshooting

If the `Light Ease` tab does not appear or the light sheet fails to render:

1. Confirm the module is installed at `Data/modules/soft-light-ease`
2. Reload Foundry completely
3. Check the browser console for module load errors
4. Verify the module files listed above exist in the installed directory

If another module also modifies the Ambient Light sheet or lighting shaders, incompatibilities are possible.

## File Overview

- [module.json](./module.json)
- [scripts/module.mjs](./scripts/module.mjs)
- [styles/module.css](./styles/module.css)
- [languages/en.json](./languages/en.json)
- [templates/ambient-light-easing.hbs](./templates/ambient-light-easing.hbs)

## License

No license file is currently included. Add one before distributing the module publicly.
