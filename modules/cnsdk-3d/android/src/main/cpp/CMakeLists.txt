cmake_minimum_required(VERSION 3.22.1)

project(cnsdk3d_fpscontrol_jni)

add_library(cnsdk3d_fpscontrol_jni SHARED fps_control_jni.c)

target_link_libraries(cnsdk3d_fpscontrol_jni log binder_ndk)
