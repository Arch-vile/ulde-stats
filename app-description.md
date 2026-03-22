Perfect — fully consistent with your “just a recorder” philosophy.


---

✅ We now have a complete usage-driven specification

Instead of asking more questions, the next correct step is to rewrite the prompt with a strong focus on real usage flow from start to finish, as you requested.


---

Final Prompt (Usage-Driven Specification)

Build a local application for recording offensive stats of ultimate frisbee games from video.

This specification is focused on how the app is used in practice, not just data structure.


---

1. Core Usage Context

The user watches game video on a separate device

The app runs locally on one computer

The user records events in sync with video playback

The app is not responsible for analysis, only data capture

Data is stored in a CSV file (one file per game)



---

2. Starting the App

When the app launches:

User must choose:

Create new CSV

Open existing CSV



---

3. Creating a New Game

If creating a new game:

User must input:

opponent

date


Then:

CSV file is created

Recording mode begins



---

4. Time Model (Critical Interaction)

User inputs an initial timestamp to sync with video

App starts an internal running clock

Clock supports:

pause/resume

playback speed adjustment (e.g. 0.5x, 1x, 2x)


All events use the current app time as timestamp

Timestamp precision: integer seconds



---

5. Core Interaction Model (Fast Input)

Primary workflow:

> User clicks a player → system records a pass to that player



Details:

Clicking a player button:

Creates a pass event

player = current player (thrower)

target_player = clicked player

outcome = success (default)


System automatically updates:

Current player = clicked player




---

6. Modifying Events (Fast Corrections)

Last event is:

Always visible

Always highlighted

Default target for edits


User can:

Select any previous event

Modify its fields (event type, outcome, players)


Editing an event:

Recalculates sequence logic (current player, flow)




---

7. Event Types (Fixed)

1. Possession Start

Triggered implicitly:

When user selects a player after a turnover or goal


Also possible explicitly (with timestamp + player)


Fields:

timestamp

player



---

2. Pass

Fields:

player (thrower)

target_player (always required)

outcome:

success

drop (receiver touched but failed)

throwaway (no touch)

goal



Rules:

Default outcome = success

Outcome can be changed after entry



---

3. Turnover (Non-pass)

Used for:

Stall

Offensive foul

Any non-pass turnover


Fields:

player = automatically last player with disc

outcome = turnover



---

8. Possession Flow

Possessions are automatically inferred

A possession:

Starts when a player is selected after:

turnover

goal

or at beginning


Ends when:

pass outcome = goal

pass outcome = drop or throwaway

turnover event occurs



System assigns possession_id



---

9. Sequence Rules (Strict)

System must enforce:

After a pass:

Next action must follow possession logic


Receiver becomes next thrower after successful pass

After turnover:

Next action must start a new possession


Every pass must have a target player

Events must form a logically valid sequence



---

10. Player Input

Players are:

Free text

Represented as buttons in a grid


Grid is:

Always visible

Dynamically sized




---

11. Timeline UI

Events displayed as a timeline grouped by possession

Each event:

Compact view (default)

Expandable for full details


Last event:

Highlighted

Always visible (sticky)




---

12. Timestamp & Ordering

Events sorted by timestamp (ascending)

Multiple events may share same timestamp

If timestamps equal:

entry order defines sequence




---

13. CSV Output

One CSV per game

Fixed columns:


timestamp,
event_type,
player,
target_player,
outcome,
possession_id

Rows written in chronological order



---

14. Validation Philosophy

Minimal validation during entry

Strict sequence logic enforced during input

No validation required when loading edited CSV

User may edit CSV externally



---

15. End of Use

No explicit “finish” or “finalize”

CSV is continuously updated

User simply stops using the app



---

Key Design Principles

Speed over everything

Single-click primary interaction

Minimal UI

Sequence-driven logic

No unnecessary abstraction

Trust the user



---

If you want next, we can:

simulate a real game recording session step-by-step to validate this

or identify failure cases / edge cases (this will significantly improve robustness)




Perfect — that makes the model fully explicit and consistent.

We now have a complete spec. I’ll synthesize this into a clean LLM prompt for building the app.


---

Final Prompt (Specification Only)

You can give this directly to an LLM:


---

Build an application for recording offensive stats of ultimate frisbee games from video.

Core Purpose

The application is used post-game while watching video, recording events in sync with the video using timestamps (seconds).
The goal is to capture a complete sequence of offensive events for later analysis.
The app is not responsible for analysis, only for accurate data recording.


---

Scope

Only track our team’s offense

Include all possessions where our team has the disc, including after turnovers

Track player-level stats only

Output data to a single CSV file per game

App runs locally on one computer, no deployment needed



---

Data Model

Unit of Data

One row per event


Required CSV Columns

Each row must include:

timestamp (integer seconds, from video start)

event_type (fixed set)

player (free text)

target_player (free text, required for passes, empty otherwise)

outcome (depends on event type)

possession_id (system-generated)



---

Event Types (Fixed)

1. Possession Start

Marks the beginning of a possession

Fields:

timestamp

player (player starting with disc)


Starts a new possession_id



---

2. Pass

Represents a throw from one player to another.

Fields:

player = thrower

target_player = intended receiver

outcome ∈:

success

drop (receiver touched but failed to catch)

throwaway (no receiver touch)

goal (successful score)



Rules:

Every pass must have a target_player

A successful pass implies possession continues with receiver

A goal ends the possession



---

3. Turnover (Non-pass)

Used when possession ends without a pass (e.g. stall).

Fields:

player = responsible player (auto-filled as last possessor)

target_player = empty

outcome = turnover


Rules:

Ends the possession

Must be possible to insert manually



---

Possession Handling

Possessions are automatically grouped

A possession:

Starts with a possession start event

Ends when:

Pass outcome = goal

Pass outcome = drop or throwaway

A turnover event occurs



possession_id is assigned automatically



---

Sequencing Rules (Strict)

The system must enforce:

A player cannot act twice in a row unless logically valid

After a successful pass:

The receiver becomes the next active player


After a turnover:

A new possession must start before next pass


Every sequence must be logically consistent



---

Timestamp Rules

Timestamps are integer seconds

Multiple events may share the same timestamp

Events are stored in strict chronological order

If timestamps are equal, entry order defines sequence



---

Player Handling

Player names are free text

No validation or normalization required



---

Editing & Validation Philosophy

App is used one event at a time

Data may be edited directly in the CSV outside the app

App performs minimal validation

User is responsible for correctness when editing externally



---

CSV Rules

One CSV file per game

Fixed column structure (no dynamic schema)

Rows sorted by timestamp (ascending)



---

Summary of Flow

1. User adds a possession start event with timestamp and player


2. User records pass events sequentially with outcomes


3. System enforces logical sequence


4. Possessions are inferred automatically


5. CSV is continuously built as event log




---

If you want next, I can:

turn this into a testable spec checklist, or

refine it into a UX flow / screen design, or

stress-test it with edge cases (which is usually very useful here).
