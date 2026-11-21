/*
 * Robotic Arm Controller - Arduino Mega 2560 Firmware
 *
 * Protocol (115200 baud, framed with '<' and '>'):
 *   PC -> Mega:
 *     <M:a0,a1,a2,a3,a4,a5,spd>  Move joints to angles (deg) at spd (deg/s)
 *     <H>                        Move to HOME_ANGLES
 *     <E>                        Emergency Stop (freeze motion, enter ESTOPPED)
 *     <R>                        Reset from ESTOPPED to READY
 *     <P>                        Ping
 *
 *   Mega -> PC:
 *     <TEL:a0,a1,a2,a3,a4,a5,STATE>
 *     <OK:CMD>
 *     <ERR:REASON>
 *     <PONG>
 */

#include <Servo.h>
#include <stdlib.h>
#include <string.h>
#include "config.h"

enum ArmState {
  STATE_READY,
  STATE_MOVING,
  STATE_ESTOPPED
};

Servo servos[NUM_JOINTS];
float currentAngles[NUM_JOINTS];
float targetAngles[NUM_JOINTS];
float motionSpeedDps = DEFAULT_SPEED_DPS;
ArmState armState = STATE_READY;

char rxBuffer[RX_BUFFER_SIZE];
size_t rxIndex = 0;
bool receivingFrame = false;

unsigned long lastServoUpdateMs = 0;
unsigned long lastTelemetryMs = 0;

float clampFloat(float val, float minVal, float maxVal) {
  if (val < minVal) return minVal;
  if (val > maxVal) return maxVal;
  return val;
}

const char* stateToString(ArmState s) {
  switch (s) {
    case STATE_READY: return "READY";
    case STATE_MOVING: return "MOVING";
    case STATE_ESTOPPED: return "ESTOPPED";
    default: return "UNKNOWN";
  }
}

void writeServos() {
  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    int deg = (int)(currentAngles[i] + 0.5f);
    servos[i].write(deg);
  }
}

void sendTelemetry() {
  Serial.print("<TEL:");
  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    Serial.print(currentAngles[i], 1);
    Serial.print(',');
  }
  Serial.print(stateToString(armState));
  Serial.println('>');
}

void handleMoveCommand(char* payload) {
  if (armState == STATE_ESTOPPED) {
    Serial.println("<ERR:ESTOPPED>");
    return;
  }

  float parsed[NUM_JOINTS + 1];
  uint8_t count = 0;
  char* token = strtok(payload, ",");

  while (token != nullptr && count < (NUM_JOINTS + 1)) {
    parsed[count++] = (float)atof(token);
    token = strtok(nullptr, ",");
  }

  if (count < NUM_JOINTS) {
    Serial.println("<ERR:BAD_ARG_COUNT>");
    return;
  }

  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    targetAngles[i] = clampFloat(parsed[i], MIN_ANGLES[i], MAX_ANGLES[i]);
  }

  if (count == NUM_JOINTS + 1) {
    motionSpeedDps = clampFloat(parsed[NUM_JOINTS], MIN_SPEED_DPS, MAX_SPEED_DPS);
  }

  armState = STATE_MOVING;
  Serial.println("<OK:M>");
}

void handleHomeCommand() {
  if (armState == STATE_ESTOPPED) {
    Serial.println("<ERR:ESTOPPED>");
    return;
  }

  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    targetAngles[i] = clampFloat(HOME_ANGLES[i], MIN_ANGLES[i], MAX_ANGLES[i]);
  }
  motionSpeedDps = DEFAULT_SPEED_DPS;
  armState = STATE_MOVING;
  Serial.println("<OK:H>");
}

void handleEstopCommand() {
  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    targetAngles[i] = currentAngles[i];
  }
  armState = STATE_ESTOPPED;
  Serial.println("<OK:E>");
  sendTelemetry();
}

void handleResetCommand() {
  if (armState == STATE_ESTOPPED) {
    for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
      targetAngles[i] = currentAngles[i];
    }
    armState = STATE_READY;
  }
  Serial.println("<OK:R>");
  sendTelemetry();
}

void processFrame(char* frame) {
  if (frame[0] == '\0') {
    return;
  }

  if (strncmp(frame, "M:", 2) == 0) {
    handleMoveCommand(frame + 2);
  } else if (strcmp(frame, "H") == 0) {
    handleHomeCommand();
  } else if (strcmp(frame, "E") == 0) {
    handleEstopCommand();
  } else if (strcmp(frame, "R") == 0) {
    handleResetCommand();
  } else if (strcmp(frame, "P") == 0) {
    Serial.println("<PONG>");
  } else {
    Serial.println("<ERR:UNKNOWN_CMD>");
  }
}

void pollSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '<') {
      receivingFrame = true;
      rxIndex = 0;
    } else if (c == '>' && receivingFrame) {
      rxBuffer[rxIndex] = '\0';
      receivingFrame = false;
      processFrame(rxBuffer);
    } else if (receivingFrame) {
      if (rxIndex < RX_BUFFER_SIZE - 1) {
        rxBuffer[rxIndex++] = c;
      } else {
        // Buffer overflow protection: discard malformed frame
        receivingFrame = false;
        rxIndex = 0;
        Serial.println("<ERR:FRAME_OVERFLOW>");
      }
    }
  }
}

void updateMotion(unsigned long nowMs) {
  if (nowMs - lastServoUpdateMs < SERVO_UPDATE_INTERVAL_MS) {
    return;
  }

  float dt = (nowMs - lastServoUpdateMs) / 1000.0f;
  lastServoUpdateMs = nowMs;

  if (armState == STATE_ESTOPPED) {
    return;
  }

  float maxStep = motionSpeedDps * dt;
  bool anyMoving = false;

  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    float diff = targetAngles[i] - currentAngles[i];
    if (fabs(diff) > 0.05f) {
      anyMoving = true;
      if (fabs(diff) <= maxStep) {
        currentAngles[i] = targetAngles[i];
      } else {
        currentAngles[i] += (diff > 0.0f ? maxStep : -maxStep);
      }
    } else {
      currentAngles[i] = targetAngles[i];
    }
  }

  writeServos();
  armState = anyMoving ? STATE_MOVING : STATE_READY;
}

void setup() {
  Serial.begin(SERIAL_BAUD);

  for (uint8_t i = 0; i < NUM_JOINTS; ++i) {
    float home = clampFloat(HOME_ANGLES[i], MIN_ANGLES[i], MAX_ANGLES[i]);
    currentAngles[i] = home;
    targetAngles[i] = home;
    servos[i].attach(SERVO_PINS[i]);
  }

  writeServos();
  lastServoUpdateMs = millis();
  lastTelemetryMs = millis();

  Serial.println("<OK:BOOT>");
  sendTelemetry();
}

void loop() {
  pollSerial();

  unsigned long nowMs = millis();
  updateMotion(nowMs);

  if (nowMs - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = nowMs;
    sendTelemetry();
  }
}
