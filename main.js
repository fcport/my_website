import "./style.css";

const SECTION_IDS = ["ABOUTME", "WORKHISTORY", "BLOG", "EDU", "CONTACTS"];

// reloading a deep link put the browser's remembered scroll offset in a race
// with the jump to the top of the reopened panel, and the offset usually won
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const connection = navigator.connection || {};
const frugal =
  connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType || "");

// the solar system is scenery everywhere, but it is only the navigation on a
// pointer. phones get the same sky, orbiting and zooming, with nothing to aim
// at: the buttons do that job, and a 40px fingertip never had a chance against
// a 20px planet.
const wantsSpace = !reducedMotion && !frugal && supportsWebGL();

let space = null;
let openSectionId = null;
let lastFocusedTrigger = null;

const nav = document.querySelector(".section-nav");
const canvas = document.querySelector("#bg");

function supportsWebGL() {
  try {
    const probe = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (probe.getContext("webgl") || probe.getContext("experimental-webgl"))
    );
  } catch (error) {
    return false;
  }
}

// ------------------------------------------------------------------ sections

// below this width a panel is a sheet over the lower part of the screen rather
// than a column beside the header, which changes both what the panel covers
// and where the focused planet has to sit to stay visible above it
const sheetLayout = window.matchMedia("(max-width: 1100px)");

// where the focused planet lands, as a fraction of the frustum from centre.
// beside a column: low and to the left, clear of the text. under a sheet: high
// and centred, in the band of sky the sheet leaves open.
function planetFraming() {
  return sheetLayout.matches ? { x: 0, y: 0.42 } : { x: -0.34, y: -0.32 };
}

// at rest on a phone the system sits in the band of sky between the header and
// the footer. measuring the band instead of using a fixed fraction of the
// viewport is what keeps a bright sun off the text on a shorter screen.
function homeScreenY() {
  if (!sheetLayout.matches) return 0;

  const top = document.querySelector("header").getBoundingClientRect().bottom;
  const bottom = document.querySelector("footer").getBoundingClientRect().top;
  const half = window.innerHeight / 2;
  const bandCentre = bottom > top ? (top + bottom) / 2 : half;

  return Math.max(-0.55, Math.min(0, -((bandCentre - half) / half)));
}

function sectionEl(id) {
  return document.getElementById(id);
}

function navLink(id) {
  return document.querySelector(`.nav-link[data-section="${id}"]`);
}

// under a sheet the header and footer are hidden outright rather than left
// underneath it: covered-but-focusable strands keyboard and screen reader
// users behind a panel they cannot see
sheetLayout.addEventListener("change", () => {
  document.body.classList.toggle("space-interactive", !sheetLayout.matches);
  if (!space) return;
  space.setLayout(sheetLayout.matches ? "narrow" : "wide");
  if (openSectionId) space.focus(openSectionId, planetFraming());
});

function openSection(id, { fromNav = false } = {}) {
  if (!SECTION_IDS.includes(id) || openSectionId === id) return;
  if (openSectionId) closeSection({ restoreFocus: false, keepSpace: true });

  const section = sectionEl(id);
  section.hidden = false;
  // the panel animates its height, so it needs to be laid out before the
  // class that grows it lands
  requestAnimationFrame(() => section.classList.add("is-open"));

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.setAttribute("aria-expanded", String(link.dataset.section === id));
  });

  openSectionId = id;
  if (fromNav) lastFocusedTrigger = navLink(id);
  document.body.classList.add("is-panel-open");

  // move the reading position to the panel that just appeared, so a keyboard
  // or screen reader user carries on from there instead of from the nav
  section.focus({ preventScroll: true });

  if (sheetLayout.matches) {
    // the sheet opens partway down the page and rises as you scroll, so start
    // at the top: that is where the window onto the planet is
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (!space) {
    section.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  if (space) space.focus(id, planetFraming());
  if (history.replaceState) history.replaceState(null, "", `#${id}`);
}

function closeSection({ restoreFocus = true, keepSpace = false } = {}) {
  if (!openSectionId) return;

  const section = sectionEl(openSectionId);
  section.classList.remove("is-open");
  section.hidden = true;

  document
    .querySelectorAll(".nav-link")
    .forEach((link) => link.setAttribute("aria-expanded", "false"));

  const closed = openSectionId;
  openSectionId = null;

  // clear this before restoring focus: the header is display:none under a
  // sheet, and you cannot focus what is not being rendered
  document.body.classList.remove("is-panel-open");

  if (space && !keepSpace) space.reset();
  if (history.replaceState) history.replaceState(null, "", " ");

  if (restoreFocus) {
    (lastFocusedTrigger || navLink(closed) || nav).focus();
    lastFocusedTrigger = null;
  }
}

nav.addEventListener("click", (event) => {
  const link = event.target.closest(".nav-link");
  if (!link) return;
  event.preventDefault();
  const id = link.dataset.section;
  if (openSectionId === id) closeSection();
  else openSection(id, { fromNav: true });
});

document.querySelectorAll(".back").forEach((button) => {
  button.addEventListener("click", () => closeSection());
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openSectionId) closeSection();
});

// deep links: /#WORKHISTORY opens straight into that section
function openFromHash({ initial = false } = {}) {
  const id = window.location.hash.replace("#", "");
  if (!SECTION_IDS.includes(id)) return;

  openSection(id);
  if (!initial || !sheetLayout.matches) return;

  // the fragment names a real element, so the browser scrolls to it on its
  // own, after this script has run. undo that once layout settles: a reloaded
  // deep link should start where a tapped one does, at the top, looking at
  // the planet.
  const toTop = () => window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(toTop);
  window.addEventListener("load", toTop, { once: true });
}
window.addEventListener("hashchange", () => openFromHash());

// ------------------------------------------------------------- contact form

const contactForm = document.querySelector("#contactForm");
const contactStatus = document.querySelector("#contactStatus");
const thanksDialog = document.querySelector("#thxDialog");

function setStatus(message, tone = "error") {
  contactStatus.textContent = message;
  contactStatus.dataset.tone = tone;
}

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = contactForm.elements.email;
  const message = contactForm.elements.message;

  if (!email.value.trim() || !email.checkValidity()) {
    setStatus("Please enter a valid email address so I can reply.");
    email.focus();
    return;
  }
  if (!message.value.trim()) {
    setStatus("Please write a message before sending.");
    message.focus();
    return;
  }

  const submit = contactForm.querySelector("button[type='submit']");
  submit.disabled = true;
  setStatus("Sending…", "pending");

  try {
    const response = await fetch("https://formspree.io/f/meqbqgrw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email.value, message: message.value }),
    });

    if (!response.ok) throw new Error(`Formspree replied ${response.status}`);

    contactForm.reset();
    setStatus("", "idle");
    if (typeof thanksDialog.showModal === "function") thanksDialog.showModal();
    else setStatus("Thanks! I'll get back to you as soon as I can.", "success");
  } catch (error) {
    setStatus(
      "Something went wrong sending the form. You can email me directly at contact@federicocasadei.dev."
    );
  } finally {
    submit.disabled = false;
  }
});

thanksDialog.querySelector("button").addEventListener("click", () => {
  thanksDialog.close();
});

thanksDialog.addEventListener("close", () => {
  // the contacts panel is still on screen, so focus belongs there rather than
  // on a nav link sitting behind a full screen sheet
  (sectionEl("CONTACTS") || navLink("CONTACTS")).focus();
});

// ------------------------------------------------------------ the 3D scene

function startSpace() {
  import("./space.js")
    .then(({ createSpace }) => {
      space = createSpace({
        canvas,
        reducedMotion,
        layout: sheetLayout.matches ? "narrow" : "wide",
        getHomeScreenY: homeScreenY,
        onSelect: (id) => {
          lastFocusedTrigger = navLink(id);
          openSection(id);
        },
      });

      return space.ready.then(() => {
        canvas.classList.add("is-visible");
        // a deep link has already chosen where the camera belongs. flying the
        // intro first would leave two tweens dragging it in opposite
        // directions, which is what left a reloaded #SECTION staring at
        // empty sky.
        if (openSectionId) space.focus(openSectionId, planetFraming());
        else space.playIntro();
      });
    })
    .catch((error) => {
      // no scene is a fine outcome: the page never depended on it. say so
      // anyway, so a broken scene is not indistinguishable from a small window
      console.warn("Skipping the 3D scene:", error);
      document.body.classList.remove("has-space", "space-interactive");
      space = null;
    });
}

if (wantsSpace) {
  document.body.classList.add("has-space");
  document.body.classList.toggle("space-interactive", !sheetLayout.matches);

  // the page is usable the moment it paints; the sky can arrive afterwards
  if ("requestIdleCallback" in window) {
    requestIdleCallback(startSpace, { timeout: 2500 });
  } else {
    window.addEventListener("load", () => setTimeout(startSpace, 200));
  }
}

openFromHash({ initial: true });
