const int xPin = A0;
const int yPin = A1;
const int swPin = 2;
bool lastButton = HIGH;
String lastDir = "";

void setup() {
  Serial.begin(9600);
  pinMode(swPin, INPUT_PULLUP);
}

void loop() {
  int x = analogRead(xPin);
  int y = analogRead(yPin);
  bool button = digitalRead(swPin);

  String dir = "";

  if (x < 350)       dir = "LEFT";
  else if (x > 670)  dir = "RIGHT";
  else if (y < 350)  dir = "UP";
  else if (y > 670)  dir = "DOWN";
  // anything between 350-670 is deadzone, sends nothing

  if (dir != "" && dir != lastDir) {
    Serial.println(dir);
  }
  lastDir = dir;

  if (button == LOW && lastButton == HIGH) Serial.println("PRESS");
  lastButton = button;

  delay(150);
}