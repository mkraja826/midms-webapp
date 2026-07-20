# V18 waiting-room web alignment

The browser build prepares the receptionist and owner waiting-room rows with the v18 actions:

- calendar button to choose a new appointment date and time;
- green completed button to remove the patient from the active waiting queue;
- busy-state protection against duplicate completion actions;
- browser-native confirmation and date/time input fallback.

The source preparation is idempotent and runs before typechecking, local web startup, and production export.
