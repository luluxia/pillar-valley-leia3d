# 幻柱峡谷 3D

这是基于 Evan Bacon 的 [Pillar Valley](https://github.com/EvanBacon/pillar-valley) 二次开发的 RedMagic/Leia 裸眼 3D 适配版本。项目保留原游戏的 Three.js 玩法，并针对搭载 Leia CNSDK 的红魔平板设备增加 half-SBS 立体渲染、CNSDK 输入 Surface 接入和景深调节。

## 主要改动

- 将 Three.js 画面以 half-SBS 方式渲染为左右眼图像，并传入 CNSDK `TextureView3D`。
- 增加本地 Expo 模块 `cnsdk-3d`，负责开启 Leia 3D、背光、面部追踪和帧率相关的设备侧设置。
- 通过 `patch-package` 修改 `react-native-wgpu` Android Surface，使 WebGPU 画布进入 CNSDK 输入链路。
- 在设置页加入裸眼 3D 景深强度调节，支持运行时修改并在返回游戏后重建 stereo camera。
- 精简原项目中与当前 Android 裸眼 3D 版本无关的快捷方式、成就、商店跳转、隐私页等功能。
- 将主要应用文本本地化为中文，应用名为“幻柱峡谷 3D”。

## 目录说明

- `src/`：游戏、UI 和状态管理源码。
- `modules/cnsdk-3d/`：本地 Expo Android 模块，包含 CNSDK 控制和 JNI 帧率辅助代码。
- `modules/cnsdk-3d/android/maven/`：Leia CNSDK 0.10.31 本地 Maven 依赖。
- `patches/`：`patch-package` 补丁，用于让 `react-native-wgpu` 使用 CNSDK 3D Surface。
- `icons/`：应用图标和启动图资源。

调试截图、Android 构建目录、环境变量文件、商店素材和 APK/AAB 产物不会提交到仓库。正式 APK 通过 GitHub Release 发布。

## 环境要求

- Node.js 与 Yarn。
- Android SDK、NDK、CMake 和 JDK，版本以 Expo/React Native 55/0.83 所需环境为准。
- RedMagic/Leia 裸眼 3D Android 设备用于真实 3D 效果验证。

## 安装依赖

```bash
yarn install
```

`postinstall` 会自动运行 `patch-package`。如果依赖被重装，请确认 `patches/react-native-wgpu+0.4.2.patch` 已成功应用。

## 生成 Android 工程

仓库不提交 Expo 生成的 `android/` 目录。首次构建或清理后可运行：

```bash
npx expo prebuild --platform android
```

`app.config.ts` 会把本地 CNSDK Maven 仓库加入 Android Gradle 配置，并为主 Activity 注入沉浸式全屏逻辑。

## 构建 Release APK

```powershell
.\android\gradlew.bat -p android :app:assembleRelease
```

构建完成后 APK 位于：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 安装到设备

推荐用 push + `pm install`，避免某些设备上 `adb install` 触发系统安装确认导致卡住：

```powershell
adb -s <device-id> push android/app/build/outputs/apk/release/app-release.apk /data/local/tmp/pillar-valley-release.apk
adb -s <device-id> shell pm install -r /data/local/tmp/pillar-valley-release.apk
```

## 裸眼 3D 渲染要点

游戏内部使用 `THREE.StereoCamera` 分别渲染左右眼，并将两个眼图写入同一个 2x1 atlas：左眼在左半屏，右眼在右半屏。该 atlas 作为 half-SBS 输入传给 CNSDK，由设备侧完成裸眼 3D 显示。

不要把左右眼单独拉伸成全屏后再交给 CNSDK；每只眼应先压缩到半宽，保持原始画面比例，再进入 CNSDK 的 3D Surface。

## License

本项目继承原项目的 MIT License。原始游戏作者为 Evan Bacon。
