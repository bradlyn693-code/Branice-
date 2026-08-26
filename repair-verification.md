# Branice Repair Verification

The refreshed login screen presents only email and password controls, a create-account mode, and no social sign-in options. The app-install action is also available before authentication. The production landing page retained its visible install action, while the repaired server was validated locally and after rollout with an authenticated two-player room smoke test that covered registration, session-cookie issuance, repeat email-and-password sign-in, room creation, joining, legal move persistence, opponent state retrieval, and anonymous-access rejection.

The published `/login` page was visually verified after rollout. It exposes the **Install Branice** control and only the email and password fields, as intended.

The published install control was exercised, and a browser-level inspection confirmed that the deployed page is controlled by an **activated** service worker at the application scope. The production manifest exposes fixed **192×192** and **512×512** icons plus installed-app quick actions for `/?action=create` and `/?action=join`.
