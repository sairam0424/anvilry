import { configure } from "@testing-library/react";

/**
 * Testing Library's waitFor and findBy* queries give up after 1,000 ms by default. The Vercel build
 * runs the whole suite in parallel on a loaded container, where the first render of a DOM test file
 * can take longer than that, so a correct test could fail the deploy. Reproduced locally under eight
 * concurrent suites: 24 of the 25 failures were this timeout. Ten seconds costs nothing when the UI
 * settles at once, and a condition that never becomes true still fails, only later.
 */
configure({ asyncUtilTimeout: 10_000 });
