# Chores: routines, taking turns and "when needed"

## 🔢 Routine order

On Chores & Tasks (👥 By person), the **🔢** button on someone's column puts their chores and
to-dos in the order they should do them. Use ↑ ↓, then **✓ Done**. A parent can set anyone's
order, and each person can set their own.

- **Numbers:** they show on the cards (1, 2, 3…) on Chores & Tasks, the Family Board and the floor
  plan's person popup.
- **Every job is listed:** the order covers all of the person's jobs, including weekly ones that
  aren't on today's list, so they keep their place. One-time jobs that are already done are left
  out.
- **Unordered jobs:** jobs the person hasn't put in order come after the ordered ones.

**On the floor plan**, the avatar stands at the first unfinished job in that order. When it's
checked off, the avatar walks to the next one along the same curved line the 👣 path draws. If
the next job is in the same spot, the avatar spins around and bounces a couple of times instead.


## 🔄 Taking turns (parents only)

Use this for a chore that the kids rotate through, like emptying the dishwasher.

1. Open the chore's ✎ form and pick a repeating schedule.
2. Tick **🔄 Take turns — each time it's done, it goes to the next person**.
3. Add the people and put them in order with ↑ ↓.
4. Mark who's **Up now**.

**How turns pass.** The chore sits on one person until it's done, then it goes to the next
person, and after the last person back to the first. Turns follow the chore being done, not the
calendar. If Sam doesn't do it today, it's still Sam's tomorrow. A day it was done counts as one
turn, even when it has morning and evening slots.

**Where it shows.** Each day the chore is in that person's column, progress bars, floor-plan
walk, history and Prize Bank rewards. When it's done, it shows as done by whoever did it. The
card's **🔄 next: …** badge says whose turn is after that.

**Who can change it.** Only a parent can set up, change or stop a rotation. Once parents have
passwords, the server enforces this as well. A rotating chore can't be dragged to another
person's column; change it in ✎ instead.

## 🔔 When needed

Choose the **When needed** schedule for a chore that doesn't come up on a fixed schedule, like
the dishwasher, the trash or the litter box.

- **While it's waiting**, it's on nobody's list. It sits in the **When needed** strip at the top of
  Chores & Tasks, showing whose turn it is if it rotates.
- **When it needs doing**, anyone taps **🔔** on it. It then shows on that person's list until
  someone checks it off.
- **Once it's done**, it goes back to waiting for the next 🔔. Unchecking it puts it back on the
  list.
- **Combined with 🔄 Take turns**, each 🔔 lands on the next person in the rotation.

This doesn't count toward "missed chores" in the stats, since nothing was due.

Limit: a "when needed" chore can be done once per day. A 🔔 on the same day it was finished
shows it the next day.

## Data

Only new things were added: the columns `tasks.rotation`, `tasks.rotation_start` and `tasks.needed_since`, and the table `task_positions` (each person's routine order).
No existing data changes.
