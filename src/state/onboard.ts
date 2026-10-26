/** Set right after onboarding completes, before the settings live query catches up. */
let done = false;
export const onboardedNow = () => done;
export const setOnboardedNow = (v: boolean) => { done = v; };
