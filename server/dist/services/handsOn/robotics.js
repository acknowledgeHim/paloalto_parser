/** 🤖 Hands-on: robotics — from what's inside a robot to building one from scratch; points to FIRST/VEX competitions and industrial robot certificates (format: ../mathLessonsParse.ts; right choice starred). Code goes between \`\`\` lines. */
export const HO_ROBOTICS = `
@ robo-path | 🤖 Robotics | 🎓 Robotics: competitions, certificates and careers
Robotics mixes **everything** in Hands-on: building (mechanical), wiring (electrical), and coding (programming).

## Competitions (the best way to start)
- **FIRST LEGO League** (ages about 4–16) — build and code LEGO robots, plus a research project.
- **FIRST Tech Challenge** (grades 7–12) and **FIRST Robotics Competition** (grades 9–12) — bigger metal robots built by a team in a few weeks. Teams win awards and members can apply for **college scholarships**.
- **VEX IQ** (elementary and middle school) and **VEX V5** (middle and high school) — robot games with leagues all over the world.
Ask your school or library about a team — or start one.

## Industrial robot certificates
Factories use robot arms for welding, painting and packing. Technicians who set them up and fix them can earn credentials like **FANUC** robot operator certificates and **SACA** (Smart Automation Certification Alliance) certificates, often through high-school or community-college programs. Electrical (⚡) and programming (🧑‍💻) skills from Hands-on help a lot here.

## Careers
- **Robotics / automation technician** (2-year degree or certificate)
- **Mechatronics** technician — mechanical + electronics + controls
- **Robotics engineer** — 4-year degree in mechanical, electrical or computer engineering, or computer science
? FIRST Robotics Competition is for grades … | *9–12 | K–1 | college only
? Robotics combines … | *mechanical building, electronics and programming | only painting | only typing
? A tech who works on mechanical + electronics + controls is a … | *mechatronics technician | baker | pilot
? FANUC and SACA certificates are about … | *industrial robots and automation | cooking | swimming

@ robo-parts | 🤖 Robotics | What makes a robot: sense, think, act
A robot is a machine that **senses** the world, **thinks** (decides what to do), and **acts** — over and over.

## The parts
- **Frame (chassis)** — the body: aluminum, plastic, wood, or LEGO
- **Actuators** — things that move: **motors**, servos, pistons
- **Sensors** — how it "feels": distance, light, touch, rotation
- **Controller** — the computer brain: a **microcontroller** like an Arduino or Raspberry Pi Pico, or a VEX/LEGO brain
- **Power** — batteries, with a switch and a fuse
- **Drivetrain** — wheels, tracks or legs, and the gears that connect them to motors
- **End effector** — the "hand": a gripper, a scoop, a magnet

## The loop
\`\`\`
while True:
    distance = read_distance_sensor()
    if distance < 20:
        turn_left()
    else:
        drive_forward()
\`\`\`
**Sense → think → act → repeat**, many times a second.
? The three things every robot does are … | *sense, think and act | sleep, eat and walk | paint, cut and drill
? A robot's "hand" is called its … | *end effector | chassis | battery
? Motors and pistons are … | *actuators | sensors | controllers
? An Arduino is a … | *microcontroller (the robot's brain) | type of wheel | sensor

@ robo-motors | 🤖 Robotics | Motors, servos, gears and PWM
## Three kinds of motors
- **DC motor** — spins when you give it power; reverse the wires to reverse it. Fast, but you don't know exactly where it is.
- **Servo** — turns to an exact **angle** (often 0–180°) and holds it. Great for arms and steering.
- **Stepper** — moves in tiny exact **steps** (often 200 per turn). Used in 3D printers.

## Motor drivers
A microcontroller pin can only give a tiny current — **never** connect a motor straight to it. A **motor driver** (an **H-bridge**) uses transistors to switch the battery's big current, forward or backward.

## PWM: speed control
**PWM** (pulse-width modulation) flicks the power on and off very fast. The **duty cycle** is how much of the time it's on: 25% on = slow, 100% = full speed. The same trick dims LEDs.

A servo reads a pulse about every **20 milliseconds**; the pulse **width** sets the angle: about **1 ms = 0°**, **1.5 ms = 90°**, **2 ms = 180°** (many servos use a slightly wider range).

## Gears: speed vs. strength (torque)
A small gear driving a big gear makes the output **slower but stronger** — a **gear ratio**. A 12-tooth gear driving a 36-tooth gear is **3:1**: one-third the speed, three times the torque.
🧪 lab: pwm
? A motor that turns to an exact angle and holds it is a … | *servo | DC motor | fan
? A 50% PWM duty cycle means the power is on … | *half the time | never | all the time
? A small gear driving a big gear makes the output … | *slower and stronger | faster and weaker | stop
? Why use a motor driver instead of wiring a motor to the controller pin? | *The pin can't supply enough current | motors like drivers | it's prettier

@ robo-sensors | 🤖 Robotics | Sensors: how robots feel the world
## Common sensors
- **Ultrasonic distance** — sends a "ping" of sound too high to hear and times the echo, like a bat. Distance = speed of sound × time ÷ 2 (there and back).
- **Infrared (IR) / line sensors** — shine IR light at the floor; a dark line reflects less. Two or three of them let a robot **follow a line**.
- **Bump / limit switches** — a simple button that's pressed when the robot touches something or an arm reaches its end.
- **Encoders** — count how far a wheel or motor has turned.
- **IMU / gyro** — senses turning and tilt, so the robot knows which way it's facing.
- **Camera** — with code (computer vision) it can find colors, shapes or tags.

## Digital and analog
- **Digital** sensors give **on/off** (1 or 0): a button.
- **Analog** sensors give a **range** of values: a light sensor might read 0 (dark) to 1023 (bright) on an Arduino.

## Noise
Real sensors jump around a little. Programs often **average** several readings.
? An ultrasonic sensor measures distance by … | *timing a sound echo | weighing things | measuring heat
? Why divide the echo time by 2? | *The sound goes there and back | sound is slow | it's a rule of thumb
? A sensor that counts how far a wheel turned is an … | *encoder | antenna | LED
? A button is a … sensor | *digital | analog | weather

@ robo-control | 🤖 Robotics | Feedback: robots that correct themselves
## Open loop vs. closed loop
- **Open loop** — "drive the motor for 2 seconds." But a low battery or a carpet changes how far it goes.
- **Closed loop** — "drive until the **encoder** says 1 meter." The robot **measures** and **corrects**. This is **feedback**.

## Proportional control
To follow a line, the robot measures how far off the line it is (the **error**) and steers **more** when the error is big and **a little** when it's small:

\`\`\`
error = line_position - center
steer = 0.5 * error
left_motor(speed + steer)
right_motor(speed - steer)
\`\`\`
The 0.5 is the **gain** (called **Kp**). Too small and the robot drifts off; too big and it wiggles back and forth. Real robots often use **PID** control (proportional + integral + derivative).

## Your thermostat does this too
It measures the temperature, compares it to the setting, and turns the heat on or off — a feedback loop.
? A robot that measures and corrects itself uses … | *closed-loop (feedback) control | open-loop control | no control
? In proportional control, a bigger error means … | *a bigger correction | no correction | the robot stops
? If the gain is too big, the robot … | *wiggles back and forth | drives perfectly | turns off
? PID stands for proportional, integral and … | *derivative | digital | direction

@ robo-code | 🤖 Robotics | Programming a robot
Robots run a program on their controller. Here's a small **Arduino** program (Arduino uses C++) that blinks an LED:

\`\`\`
void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
\`\`\`
- **setup()** runs once when it powers on.
- **loop()** runs again and again forever.
- **delay(500)** waits 500 milliseconds (half a second).

## MicroPython on a Raspberry Pi Pico
\`\`\`
from machine import Pin
import time
led = Pin(25, Pin.OUT)
while True:
    led.toggle()
    time.sleep(0.5)
\`\`\`

## Plan with small steps
Get one thing working at a time: blink an LED → spin one motor → read one sensor → put them together. Test after every change.

Practice robot steps here: program the robot to reach the ⭐, then use 🔁 Repeat.
🧪 lab: robot
? In an Arduino program, loop() … | *runs again and again forever | runs once | never runs
? delay(500) waits … | *half a second | 500 seconds | 5 minutes
? setup() runs … | *once, at power on | every second | when you press stop
? The best way to build a robot program is … | *one small working step at a time, testing each | all at once, then test | without testing

@ robo-power | 🤖 Robotics | Batteries and power safety
## Batteries
- **AA / NiMH** packs — safe and easy for small robots.
- **LiPo / lithium-ion** — light and powerful (most competition and hobby robots). They need care:
  - Charge only with the **right charger**, on a fire-safe surface, and **never leave them charging alone**.
  - A **puffy (swollen)**, dented or punctured LiPo is dangerous — stop using it and recycle it properly.
  - Never short the wires: a LiPo can dump huge current and start a fire.
- Store them half-charged in a **LiPo-safe bag**.

## Volts and amps for robots
- Motors usually want more volts and amps than the controller. Many robots have **two supplies** (or a **regulator** that makes a steady 5 V or 3.3 V for the brain).
- Connect the **grounds** (minus sides) together so signals make sense.
- A **fuse** or breaker protects against shorts. Use wire thick enough for the motor current.
- Always have a **power switch** you can reach fast.
? A swollen (puffy) LiPo battery should be … | *stopped and recycled properly | charged faster | squeezed flat
? Why have a fuse in a robot? | *to protect against shorts and fires | to make it faster | for decoration
? A regulator gives the controller … | *a steady voltage like 5 V | more motors | Wi-Fi
? Charging LiPo batteries should be … | *watched, on a fire-safe surface, with the right charger | done overnight in your bed | done with any charger

@ robo-safety | 🤖 Robotics | Robot safety: e-stops and pinch points
Robots can move **suddenly** and with a lot of force.

## For every robot
- **Emergency stop (e-stop)** — a big red button that cuts motor power **right now**. Test it.
- **Pinch points** — gears, chains and arms can catch fingers. Keep hands clear when it's powered; add guards over gears.
- Tie back hair, no loose sleeves or dangling jewelry (like with any machine).
- **Safety glasses** when building, cutting and testing.
- Turn the power **off** before reaching in to fix something.

## Industrial robots
Factory robot arms are fast and strong enough to kill. They're kept behind **fences** with **light curtains** and interlocked doors that stop the robot if opened. Technicians use **lockout/tagout** (like electricians) before entering the cell. "**Cobots**" (collaborative robots) are built to work near people, with force limits.
? An e-stop button … | *cuts motor power right away | starts the robot | plays music
? Before reaching into a robot to fix it you should … | *turn the power off | wave first | speed it up
? Gears and chains that can catch fingers are … | *pinch points | end effectors | sensors
? Robots made to work safely near people are called … | *cobots | robo-dogs | droids

@ robo-build | 🤖 Robotics | Build one from scratch: a line-following robot
This project uses everything: the **frame**, **motors**, **sensors**, **controller**, **power** and **code**. Do it with an adult.

## Parts (about the cost of a video game)
- A 2-wheel **robot chassis** kit (2 DC gear motors, wheels, a caster ball)
- A **microcontroller** (Arduino Uno or Raspberry Pi Pico)
- A **motor driver** board (a small H-bridge like a DRV8833 or L298N)
- 2 or 3 **IR line sensors**, and an **ultrasonic** sensor to stop for things in the way
- A **battery pack** (4×AA works) with a **switch**
- Jumper wires, a breadboard, screws, zip ties, black electrical tape for the track

## Build steps
1. Build the chassis; mount the motors and wheels. **Test each motor** on the battery directly.
2. Mount the controller and motor driver. Wire motors → driver → controller pins. Connect **all grounds**.
3. Write code to drive forward, back and turn. (Motors spinning the wrong way? Swap that motor's two wires.)
4. Mount the line sensors low at the front, about 1 cm off the floor. Print their readings over white floor and black tape.
5. Code the decision: left sensor on black → turn left; right sensor on black → turn right; else go straight.
6. Make a tape track and **tune** the speed and turning. Then add the ultrasonic sensor: stop if something is closer than 15 cm.
7. Upgrade: proportional steering, a gripper, Bluetooth control, or a camera.

## Engineers keep a notebook
Write down your plan, wiring, what failed and how you fixed it. FIRST and VEX teams are judged on their **engineering notebooks**.
? In the line follower, if the left sensor sees the black line, the robot should … | *turn left | turn right | stop forever
? A motor spinning the wrong way can be fixed by … | *swapping its two wires | adding more tape | a new battery
? Why connect all the grounds together? | *so the signals between boards make sense | to make it heavier | it isn't needed
? Before mounting everything, first … | *test each motor by itself | paint the robot | enter a competition
`;
