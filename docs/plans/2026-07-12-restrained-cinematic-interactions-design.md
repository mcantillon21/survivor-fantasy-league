# Restrained Cinematic Interactions

## Goal

Make interactive states feel deliberate and cinematic without adding visual noise or moving layout.

## Interaction language

- Keep rows and cards stationary on hover.
- Use a soft ember edge light instead of large background flashes.
- Move directional arrows only two to three pixels and brighten them.
- Warm primary buttons slightly on hover and scale controls to `0.96` on press.
- Give game controls a narrow amber outline and subtle surface lift, never a glow cloud.
- Limit transitions to specific composited or paint properties with interruptible timing.
- Disable decorative motion for reduced-motion users and avoid looping animations.

## Scope

Apply the system to navigation, challenge rows, buttons, answer choices, symbol controls, maze controls, command items, supply choices, back links, and compact text links. Static standings rows remain static because they are not interactive.

## Home hero backdrop

Mirror the original torch artwork across the far left and right sides of the home hero. Keep both torches symmetrical and slightly more visible than the current backdrop, while preserving a deep central falloff behind the heading and glass pane. Other pages retain the quieter single-image treatment.

## Verification

Check desktop hover, keyboard focus, active press, touch behavior, reduced-motion behavior, and mobile overflow. Confirm all challenge routes still render and build successfully.
