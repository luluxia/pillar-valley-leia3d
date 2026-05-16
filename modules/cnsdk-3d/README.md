# CNSDK 3D Android module

This local Expo module adapts Pillar Valley for RedMagic/Leia naked-eye 3D tablets.

It does three things:

- Enables Leia CNSDK 3D/backlight and in-app face tracking.
- Requests vendor high-refresh hints and repeats the SurfaceFlinger `fpsControl` unlock used by the validated CNSDK demo.
- Lets JS switch the Three.js renderer into a 2x1 packed stereo atlas: left eye in the left half, right eye in the right half.

The Android `react-native-wgpu` patch routes the game canvas into a CNSDK `TextureView3D` input surface. JavaScript renders a left/right SBS atlas into that surface; CNSDK then splits the two tiles and presents them through the device interlacing path.
