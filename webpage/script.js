const animalCount = 16;
const fallbackDurations = [12, 8, 12, 15, 12, 10, 15, 12, 8, 8, 12, 15, 10, 10, 15, 12];
const scene = document.querySelector("#scene");
const countLabel = document.querySelector("#animal-count");
const welcome = document.querySelector("#welcome");
const statusMessage = document.querySelector("#status-message");
const controls = document.querySelector(".controls");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const galleryOpenButton = document.querySelector("#gallery-open");
const galleryDialog = document.querySelector("#gallery-dialog");
const galleryCloseButton = document.querySelector("#gallery-close");
const galleryImage = document.querySelector("#gallery-image");
const galleryPosition = document.querySelector("#gallery-position");
const galleryPreviousButton = document.querySelector("#gallery-previous");
const galleryNextButton = document.querySelector("#gallery-next");
const ambientVolumeInput = document.querySelector("#ambient-volume");
const ambientVolumeValue = document.querySelector("#ambient-volume-value");
const animalVolumeInput = document.querySelector("#animal-volume");
const animalVolumeValue = document.querySelector("#animal-volume-value");

const ambient = new Audio("../sounds/ambient.wav");
ambient.loop = true;
const portraitScatter = document.querySelector("#portrait-scatter");

let activeSound = null;
let activeAnimation = null;
let isPaused = false;
const exitPositions = new Map();
const returnDurations = new Map();
const animalTextlines = new Map();
const contactSheets = [
	"../images/contact_sheet_1.jpg",
	"../images/contact_sheet_2.jpg",
	"../images/contact_sheet_3.jpg",
];
let galleryIndex = 0;

for (let number = 1; number <= animalCount; number += 1) {
	const portrait = document.createElement("img");
	portrait.className = "idle-animal";
	portrait.src = `../images/animal${number}.png`;
	portrait.alt = "";
	portrait.draggable = false;
	portrait.style.gridColumn = String(((number - 1) % 4) + 1);
	portrait.style.gridRow = String(Math.floor((number - 1) / 4) + 1);
	portrait.dataset.rotation = String(Math.round(Math.random() * 16 - 8));
	portrait.style.transform = `rotate(${portrait.dataset.rotation}deg)`;
	portraitScatter.append(portrait);
}

ambient.volume = Number(ambientVolumeInput.value);

function showStatus(message = "") {
	statusMessage.textContent = message;
	statusMessage.hidden = !message;
}

function showContactSheet(index) {
	galleryIndex = (index + contactSheets.length) % contactSheets.length;
	galleryImage.src = contactSheets[galleryIndex];
	galleryImage.alt = `Contact sheet ${galleryIndex + 1} of ${contactSheets.length}`;
	galleryPosition.textContent = `${galleryIndex + 1} / ${contactSheets.length}`;
}

function loadAnimalTextline(number) {
	if (!animalTextlines.has(number)) {
		animalTextlines.set(number, fetch(`../textlines/animal${number}.txt`)
			.then((response) => {
				if (!response.ok) throw new Error(`Could not load animal${number}.txt`);
				return response.text();
			})
			.then((textline) => textline.trim()));
	}

	return animalTextlines.get(number);
}

async function createAnimalActor(number) {
	const actor = document.createElement("div");
	const image = document.createElement("img");
	const bubble = document.createElement("span");
	actor.className = "animal-actor";
	actor.style.visibility = "hidden";
	image.className = "animal";
	image.src = `../images/animal${number}.png`;
	image.alt = "";
	image.draggable = false;
	bubble.className = "animal-bubble";
	actor.append(image, bubble);
	scene.append(actor);

	try {
		await Promise.all([
			image.decode(),
			loadAnimalTextline(number).then((textline) => {
				bubble.textContent = textline;
			}),
		]);
	} catch {
		actor.remove();
		showStatus(`Portrait ${number} or its textline could not load.`);
		return null;
	}

	return { actor, image };
}

function shuffledAnimals() {
	const order = Array.from({ length: animalCount }, (_, index) => index + 1);

	for (let index = order.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[order[index], order[swapIndex]] = [order[swapIndex], order[index]];
	}

	return order;
}

function getHomePosition(number) {
	const portrait = portraitScatter.children[number - 1];
	const bounds = portrait.getBoundingClientRect();
	const sceneBounds = scene.getBoundingClientRect();

	return {
		x: bounds.left - sceneBounds.left + bounds.width / 2,
		y: bounds.top - sceneBounds.top + bounds.height / 2,
		rotation: Number(portrait.dataset.rotation),
	};
}

function getOutsidePosition(width, height, animalWidth, animalHeight) {
	const marginX = animalWidth / 2 + 20;
	const marginY = animalHeight / 2 + 20;
	const lane = (min, max) => min + Math.random() * Math.max(0, max - min);
	const edge = Math.floor(Math.random() * 3);

	if (edge === 0) return { x: -marginX, y: lane(marginY, height - marginY) };
	if (edge === 1) return { x: width + marginX, y: lane(marginY, height - marginY) };
	return { x: lane(marginX, width - marginX), y: height + marginY };
}

function waitForSoundEnd(sound) {
	return new Promise((resolve) => {
		sound.addEventListener("ended", resolve, { once: true });
		sound.addEventListener("error", resolve, { once: true });
	});
}

function wait(duration) {
	return new Promise((resolve) => window.setTimeout(resolve, duration * 1000));
}

async function showAnimal(number, position) {
	const actorParts = await createAnimalActor(number);
	if (!actorParts) return;
	const { actor, image } = actorParts;
	const stationaryPortrait = portraitScatter.children[number - 1];
	const home = getHomePosition(number);
	const bounds = actor.getBoundingClientRect();
	const outside = getOutsidePosition(window.innerWidth, window.innerHeight, bounds.width, bounds.height);

	const sound = new Audio(`../sounds/animal${number}.wav`);
	sound.preload = "auto";
	sound.volume = Number(animalVolumeInput.value);
	activeSound = sound;

	const playbackStarted = await sound.play().then(() => {
		showStatus();
		return true;
	}, () => {
		showStatus("Animal audio could not play. Check this tab's sound and browser permissions.");
		return false;
	});
	const duration = Number.isFinite(sound.duration) && sound.duration > 0
		? sound.duration
		: fallbackDurations[number - 1];
	const soundEnded = playbackStarted ? waitForSoundEnd(sound) : wait(duration);
	stationaryPortrait.style.visibility = "hidden";
	image.style.transform = `rotate(${home.rotation}deg)`;

	actor.style.left = `${home.x}px`;
	actor.style.top = `${home.y}px`;
	activeAnimation = actor.animate([
		{
			left: `${home.x}px`,
			top: `${home.y}px`,
			transform: "translate(-50%, -50%)",
		},
		{
			left: `${outside.x}px`,
			top: `${outside.y}px`,
			transform: "translate(-50%, -50%)",
		},
	], {
		duration: duration * 1000,
		easing: "linear",
		fill: "forwards",
	});
	actor.style.visibility = "visible";
	exitPositions.set(number, outside);
	returnDurations.set(number, duration * 1000);
	if (isPaused) {
		sound.pause();
		activeAnimation.pause();
	}

	countLabel.textContent = `${String(position).padStart(2, "0")} / ${animalCount}`;

	await Promise.all([
		activeAnimation.finished.catch(() => { }),
		soundEnded,
	]);

	sound.pause();
	actor.remove();
	if (activeSound === sound) activeSound = null;
	activeAnimation = null;
}

async function returnAnimal(number, position) {
	if (!exitPositions.has(number)) return;

	const actorParts = await createAnimalActor(number);
	if (!actorParts) return;
	const { actor, image } = actorParts;

	const stationaryPortrait = portraitScatter.children[number - 1];
	const home = getHomePosition(number);
	const outside = exitPositions.get(number);
	const duration = returnDurations.get(number) || 1000;
	image.style.transform = `rotate(${home.rotation}deg)`;
	actor.style.left = `${outside.x}px`;
	actor.style.top = `${outside.y}px`;
	activeAnimation = actor.animate([
		{
			left: `${outside.x}px`,
			top: `${outside.y}px`,
			transform: "translate(-50%, -50%)",
		},
		{
			left: `${home.x}px`,
			top: `${home.y}px`,
			transform: "translate(-50%, -50%)",
		},
	], {
		duration,
		easing: "linear",
		fill: "forwards",
	});
	actor.style.visibility = "visible";
	if (isPaused) activeAnimation.pause();

	countLabel.textContent = `RETURN ${String(position).padStart(2, "0")} / ${animalCount}`;
	await activeAnimation.finished.catch(() => { });
	actor.remove();
	stationaryPortrait.style.visibility = "";
	activeAnimation = null;
}

async function runParade() {
	let previousLast = null;

	while (true) {
		const order = shuffledAnimals();
		if (order[0] === previousLast) {
			[order[0], order[1]] = [order[1], order[0]];
		}

		for (const [index, number] of order.entries()) {
			while (isPaused) {
				await new Promise((resolve) => window.setTimeout(resolve, 120));
			}
			await showAnimal(number, index + 1);
		}
		for (const [index, number] of order.slice().reverse().entries()) {
			while (isPaused) {
				await new Promise((resolve) => window.setTimeout(resolve, 120));
			}
			await returnAnimal(number, index + 1);
		}

		previousLast = order[order.length - 1];
	}
}

startButton.addEventListener("click", () => {
	welcome.remove();
	controls.hidden = false;
	ambient.play().catch(() => {
		showStatus("Ambient audio could not play. Check this tab's sound and browser permissions.");
	});
	runParade();
});

galleryOpenButton.addEventListener("click", () => {
	showContactSheet(0);
	galleryDialog.showModal();
});

galleryCloseButton.addEventListener("click", () => galleryDialog.close());
galleryPreviousButton.addEventListener("click", () => showContactSheet(galleryIndex - 1));
galleryNextButton.addEventListener("click", () => showContactSheet(galleryIndex + 1));
galleryDialog.addEventListener("click", (event) => {
	if (event.target === galleryDialog) galleryDialog.close();
});
document.addEventListener("keydown", (event) => {
	if (!galleryDialog.open) return;
	if (event.key === "Escape") {
		galleryDialog.close();
		return;
	}
	if (event.key === "ArrowLeft") showContactSheet(galleryIndex - 1);
	if (event.key === "ArrowRight") showContactSheet(galleryIndex + 1);
});

pauseButton.addEventListener("click", () => {
	isPaused = !isPaused;
	pauseButton.textContent = isPaused ? "Resume" : "Pause";
	pauseButton.setAttribute("aria-pressed", String(isPaused));

	if (isPaused) {
		ambient.pause();
		activeSound?.pause();
		activeAnimation?.pause();
	} else {
		ambient.play().catch(() => { });
		if (activeSound) activeSound.play().catch(() => { });
		activeAnimation?.play();
	}
});

ambientVolumeInput.addEventListener("input", () => {
	ambient.volume = Number(ambientVolumeInput.value);
	ambientVolumeValue.value = `${Math.round(ambient.volume * 100)}%`;
});

animalVolumeInput.addEventListener("input", () => {
	const volume = Number(animalVolumeInput.value);
	if (activeSound) activeSound.volume = volume;
	animalVolumeValue.value = `${Math.round(volume * 100)}%`;
});
