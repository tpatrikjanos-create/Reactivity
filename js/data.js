const CATEGORIES = [
  {
    id: "altalanos",
    name: "Általános",
    icon: "ti-users",
    pick3: true,
    description: "Mindenki számára megfelelő, vidám feladványok - 3 kártyából választhatsz (1/2/3 pontos)",
    words: {
      "Mutasd meg!": ["kutya","macska","elefánt","repülő","bicikli","zsiráf","pingvin","focizás","alvás","úszás","gitározás","tánc","főzés","síelés","ugrálás","kacsa","ló","teknős","majom","papagáj","horgászás","kötélhúzás","tornázás","evezés","kapuőr"],
      "Rajzold le!": ["ház","fa","nap","hold","csillag","szív","hal","virág","autó","vonat","hegy","tenger","felhő","esernyő","könyv","torta","labda","bot","szék","lámpa","híd","kút","szélmalom","delfin","szivárvány"],
      "Írd körül!": ["puha","kerek","nagy","piros","édes","hangos","gyors","nehéz","régi","fényes","illatos","hideg","meleg","kicsi","magas","érdes","sima","könnyű","sötét","átlátszó"]
    }
  },
  {
    id: "gyerek",
    name: "Gyerekzsúr",
    icon: "ti-confetti",
    description: "6–12 éves korosztálynak szóló feladványok",
    words: {
      "Mutasd meg!": ["nyuszi","béka","csiga","pillangó","superhős","tűzoltó","dínó","robot","varázslat","repülés","focizás","kacagás","alvás","evés","futás","úszás","ugrálás","biciklizés","rajzolás","éneklés"],
      "Rajzold le!": ["sárkány","kastély","szivárvány","egyszarvú","rakéta","búvár","kalóz","tündér","csillag","torta","fagyi","lufi","cukor","méhecske","tehén","vonat","tengeralattjáró","dzsungel","havas hegy","robot"],
      "Írd körül!": ["aranyos","szőrös","csíkos","pöttyös","csillogó","hangos","puha","guruló","repülő","ugráló","szúrós","nyálkás","szivárványos","óriási","apró"]
    }
  },
  {
    id: "ceges",
    name: "Céges rendezvény",
    icon: "ti-briefcase",
    description: "Irodai és üzleti környezethez passzoló feladványok",
    words: {
      "Mutasd meg!": ["tárgyalás","prezentáció","kávézás","gépelés","telefonálás","nyomtatás","értekezlet","networking","határidő","stressz","csapatmunka","home office","zoom call","brainstorm","feedback","főnök utánzás","irodai futás","fénymásolás","céges buli","onboarding"],
      "Rajzold le!": ["grafikon","folyamatábra","irodaház","laptop","tárgyalóterem","névjegykártya","organigramm","projekt","mérföldkő","csapat","dashboard","kanban tábla","roadmap","KPI","burnout"],
      "Írd körül!": ["produktív","hatékony","kreatív","profi","rugalmas","megbízható","precíz","ambiciózus","együttműködő","eredményes","túlterhelt","lelkes","visszafogott","karizmatikus","kötelességtudó"]
    }
  },
  {
    id: "tizennyolcPlus",
    name: "18+",
    icon: "ti-flame",
    description: "Felnőtteknek – vulgáris, szókimondó tartalom",
    words: {
      "Mutasd meg!": ["orgazmus","szexelés","maszturbálás","striptíz","szado-mazo","keményen csinálja","nyögdécselés","csábítás","meztelenkedés","aktus","bugyi lehúzás","mellbimbó","popsimozgatás","ejakuláció","nyalogatás","farkverés","seggbe nyomja","szopás","lovaglás","hátulról"],
      "Rajzold le!": ["pénisz","vagina","mellek","fenék","vibrátor","gumi","szexjáték","szexpóz","erekció","anális","herezacskó","dildó","fehérnemű","szőrös","borotvált"],
      "Írd körül!": ["nedves","kemény","merev","csiklandós","forró","nyirkos","feszes","lüktető","kielégítő","falósszájú","nyálkás","nyöszörgős","rángatózó","remegő","beledugja"]
    }
  },
  {
    id: "sport",
    name: "Sport & Mozgás",
    icon: "ti-ball-football",
    description: "Sportos témájú feladványok",
    words: {
      "Mutasd meg!": ["gólöröm","teniszütős","kosárdobás","úszómozgás","kerékpározás","jóga","karate","súlyemelés","futás","ugrálókötél","foci csel","célbadobás","görkorcsolya","skateboard","szörfözés","birkózás","dobás","rúgás","pörgetés","fejelés"],
      "Rajzold le!": ["stadion","olimpiai karikák","stopperóra","érem","dobogó","kapu","háló","uszoda","teniszpálya","futópálya","rajtblokk","kerékpárpálya","szánkópálya","boxring","tornászszer"],
      "Írd körül!": ["gyors","erős","rugalmas","kitartó","precíz","robbanékony","állóképes","technikás","ügyes","bátor","fáradt","lihegő","izzadt","fókuszált","agresszív"]
    }
  },
  {
    id: "film",
    name: "Film & Sorozat",
    icon: "ti-movie",
    description: "Mozi és tévé témájú feladványok",
    words: {
      "Mutasd meg!": ["Oscar-díj átvétel","rendező","akciójelenet","csók jelenet","horror nézés","popcorn evés","streaming","filmes sírás","klímaxjelenet","főgonoszt játszik","haldokló hős","jump scare","slow motion","drámai monológ","szünet gomb"],
      "Rajzold le!": ["filmszalag","stáblista","díszlet","kamera","reflektor","clapper","film poszter","mozi nézőtér","Oscar-szobor","greenscreen","storyboard","filmvágó","hangstúdió","díszletváros","streaming logo"],
      "Írd körül!": ["feszültségteli","megható","vicces","ijesztő","lenyűgöző","unalmas","váratlan","klasszikus","kultikus","megdöbbentő","nosztalgikus","tömegfilm","mélységes","elnagyolt","zseniális"]
    }
  }
];

const MODES = [
  { label: "Mutasd meg!", icon: "ti-user", hint: "Csak mutogatással, szó nélkül!" },
  { label: "Rajzold le!", icon: "ti-pencil", hint: "Csak rajzzal, szó és jel nélkül!" },
  { label: "Írd körül!", icon: "ti-writing", hint: "Egy mondatban körülírd!" }
];
