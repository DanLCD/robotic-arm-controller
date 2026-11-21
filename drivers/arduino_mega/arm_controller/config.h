#ifndef ARM_CONFIG_H
#define ARM_CONFIG_H

#include <Arduino.h>

// Number of joints: 5-DOF arm + 1 Gripper
constexpr uint8_t NUM_JOINTS = 6;

// PWM pins on Arduino Mega 2560
// J0: Base (7), J1: Shoulder (6), J2: Elbow (5), J3: Wrist Pitch (4), J4: Wrist Roll (3), J5: Gripper (2)
constexpr uint8_t SERVO_PINS[NUM_JOINTS] = {7, 6, 5, 4, 3, 2};

// Mechanical joint limits in degrees (tune to match your physical arm)
constexpr float MIN_ANGLES[NUM_JOINTS] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 75.0f};
constexpr float MAX_ANGLES[NUM_JOINTS] = {180.0f, 180.0f, 180.0f, 180.0f, 180.0f, 180.0f};

// Safe startup / Home pose in degrees
constexpr float HOME_ANGLES[NUM_JOINTS] = {90.0f, 130.0f, 180.0f, 0.0f, 90.0f, 75.0f};

// Motion & communication parameters
constexpr float DEFAULT_SPEED_DPS = 45.0f;
constexpr float MIN_SPEED_DPS = 5.0f;
constexpr float MAX_SPEED_DPS = 180.0f;

constexpr unsigned long SERIAL_BAUD = 115200;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 50;   // 20 Hz telemetry
constexpr unsigned long SERVO_UPDATE_INTERVAL_MS = 10; // 100 Hz interpolation

// Frame buffer size for deterministic, heap-free serial parsing
constexpr size_t RX_BUFFER_SIZE = 96;

#endif // ARM_CONFIG_H
