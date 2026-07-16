// Starter categories seeded into data/categories.json on first run.
// Each category has exactly 5 buzzer tiles (values 100–500).
// Feel free to edit, delete, or expand these in the Board Editor's Category DB.

const mkTile = (value: number, question: string, answer: string) => ({
  value,
  mode: "buzzer",
  question: { type: "text", content: question },
  answer: { type: "text", content: answer },
  choices: ["", "", "", ""],
  correctIndex: null,
  correctValue: null,
  double: false,
  risk: false,
});

export const STARTER_CATEGORIES = [
  {
    name: "Allgemeinwissen",
    tiles: [
      mkTile(100, "Wie viele Kontinente gibt es auf der Erde?", "Sieben"),
      mkTile(200, "Welches ist das größte Organ des menschlichen Körpers?", "Die Haut"),
      mkTile(300, "In welchem Jahr fiel die Berliner Mauer?", "1989"),
      mkTile(400, "Wie heißt die Währung Japans?", "Yen"),
      mkTile(500, "Wer schrieb das Drama \"Faust\"?", "Johann Wolfgang von Goethe"),
    ],
  },
  {
    name: "Wissenschaft",
    tiles: [
      mkTile(100, "Welches chemische Element hat das Symbol \"O\"?", "Sauerstoff"),
      mkTile(200, "Welcher Planet ist der Sonne am nächsten?", "Merkur"),
      mkTile(300, "Wie viele Knochen hat ein erwachsener Mensch ungefähr?", "206"),
      mkTile(400, "Wie schnell ist das Licht im Vakuum ungefähr?", "Rund 300.000 km/s"),
      mkTile(500, "Welches Gas nehmen Pflanzen bei der Photosynthese auf?", "Kohlenstoffdioxid (CO₂)"),
    ],
  },
  {
    name: "Geographie",
    tiles: [
      mkTile(100, "Was ist die Hauptstadt von Frankreich?", "Paris"),
      mkTile(200, "Auf welchem Kontinent liegt die Wüste Sahara?", "Afrika"),
      mkTile(300, "Welches ist das flächenmäßig größte Land der Erde?", "Russland"),
      mkTile(400, "An welchem Fluss liegt die Stadt Köln?", "Am Rhein"),
      mkTile(500, "Wie heißt die Hauptstadt von Australien?", "Canberra"),
    ],
  },
  {
    name: "Film & Fernsehen",
    tiles: [
      mkTile(100, "In welcher Filmreihe fällt der Satz \"Möge die Macht mit dir sein\"?", "Star Wars"),
      mkTile(200, "Welches Studio produzierte \"Toy Story\"?", "Pixar"),
      mkTile(300, "Welcher Schauspieler spielte Jack in \"Titanic\"?", "Leonardo DiCaprio"),
      mkTile(400, "Wie heißt der Zauberschüler aus den Romanen von J. K. Rowling?", "Harry Potter"),
      mkTile(500, "Welcher Regisseur drehte \"Pulp Fiction\"?", "Quentin Tarantino"),
    ],
  },
  {
    name: "Musik",
    tiles: [
      mkTile(100, "Welches Tasteninstrument hat 88 Tasten?", "Das Klavier"),
      mkTile(200, "Aus welchem Land stammt die Popgruppe ABBA?", "Schweden"),
      mkTile(300, "Wie viele Saiten hat eine klassische Standardgitarre?", "Sechs"),
      mkTile(400, "Welcher Künstler wird als \"King of Pop\" bezeichnet?", "Michael Jackson"),
      mkTile(500, "Auf welcher Textvorlage beruht der Schlusschor von Beethovens 9. Sinfonie?", "Schillers \"Ode an die Freude\""),
    ],
  },
];
