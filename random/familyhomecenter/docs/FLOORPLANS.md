# Floor plans: chores by room

**Chores & Tasks → 🏠 By room** shows a picture of each floor (and the yard, if you add one) with
the rooms marked. Each room shows how many jobs are left in it. Everyone's avatar stands in the
room of their next unfinished chore or to-do, with a small emoji of that job beside them. When they
check it off, they walk to the next one.

**Family Board → 🏠 House (3-D)** is the same thing, tilted like a dollhouse with everyone
standing up in it. It's meant to be left up on a screen: it picks up check-offs made elsewhere
every 15 seconds, so you can watch everyone walk to their next job. **🗺️ Flat / 🧊 3-D**
switches between the two looks on either page.

## Using it

- **Tap a room** to see its jobs and who is on each. Each person can check off their own copy
  there (or a parent can), and **+ Add a job here** adds a chore or to-do already set to that room.
- **Tap a person** to see what they're doing now, what's after that, and what they've finished
  today. Tap outside the popup to close it. Checking a job off there closes the popup so you can
  watch them walk to the next one.
- **Chips under the plan** show people whose next job is on another floor, or who have nothing
  left in a room.
- **In the add/edit chore form**, the new **Where** setting puts a job in a room. It's optional;
  jobs without a room work exactly as before.

## Setting it up (parents)

1. **Add the first plan.** Go to Chores & Tasks → 🏠 By room, give the plan a name and pick a
   picture. A drawing, a photo of a paper plan, a real-estate listing's plan, or a screenshot all
   work. For a PDF, take a screenshot of it first.
2. **Mark the rooms.** Tap **✏️ Edit plans**, then either:
   - **⬛ Drag a box** across a room, or
   - **📐 Tap the corners** of an odd-shaped room or the yard, then tap the first corner again.

   Name the room (common names are offered).
3. **Change rooms or plans.** Tap a room's name to rename, recolor, redraw or delete it.
   **+ Another floor plan** adds one per floor or for the yard. ◀ ▶ reorders the tabs, and
   **🖼️ Replace picture** keeps the rooms where they are.

## Data

Plans and rooms are stored in the `floorplans` and `floorplan_rooms` tables. The pictures are
kept in `server/data/floorplans/`. A chore's room is stored in the new `tasks.room_id` column.

Deleting a room or a plan never deletes chores: they just go back to having no room. Nothing is
sent anywhere.
