# Handoff: <short title>

<!--
Start a voice session from this file:

    handsfree --handoff path/to/this-file.md

The agent reads it, does nothing yet, and tells you in one sentence where things stand and what
the next step is. Keep it under a page: it is read by an agent, but you will be hearing the
summary, not reading it.
-->

## Goal

<!-- The outcome, in one line. -->
Make the login form show a clear error when the password is wrong.

## Where we are

<!-- What is done, what is in progress. -->
- The API already returns `401` with `{ "error": "invalid_credentials" }`.
- The form ignores it and keeps the spinner running.

## Next step

<!-- The first thing you want done when the session starts. -->
Create branch `fix/login-error`, make the form show "Wrong email or password" on a 401, and run
the login tests.

## Constraints

<!-- What not to touch. Which branch. Which tests matter. -->
- Don't change the API.
- Don't push. I'll review and push from the keyboard.

## Done means

<!-- How you'll know it worked. -->
- A wrong password shows the message and stops the spinner.
- `npm test -- login` passes.
- One local commit: `fix(login): show error on wrong password`.
