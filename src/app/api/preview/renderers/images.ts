/**
 * Curated Unsplash image library per industry — 14 categories.
 * Uses direct Unsplash Source URLs — no API key required.
 * All images are royalty-free and optimized for web.
 *
 * Each category has 5 hero images (1 per template + spare),
 * 6 gallery, 1 about, and 4 team avatars.
 */

export interface IndustryImages {
    hero: string[]
    gallery: string[]
    about: string
    team: string[]
    features: string[]
}

function u(id: string, w = 800, h = 600): string {
    return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`
}

const IMAGE_LIBRARY: Record<string, IndustryImages> = {
    restaurant: {
        hero: [
            u('photo-1517248135467-4c7edcad34c4', 1400, 800),
            u('photo-1414235077428-338989a2e8c0', 1400, 800),
            u('photo-1559339352-11d035aa65de', 1400, 800),
            u('photo-1552566626-52f8b828add9', 1400, 800), // outdoor dining
            u('photo-1600891964599-f94d51f842de', 1400, 800), // nasi lemak closeup
        ],
        gallery: [
            u('photo-1504674900247-0877df9cc836', 600, 600),
            u('photo-1476224203421-9ac39bcb3327', 600, 600),
            u('photo-1565299624946-b28f40a0ae38', 600, 600),
            u('photo-1540189549336-e6e99c3679fe', 600, 600),
            u('photo-1551218808-94e220e084d2', 600, 600),
            u('photo-1555396273-367ea4eb4db5', 600, 600),
        ],
        about: u('photo-1466978913421-dad2ebd01d17', 800, 600),
        team: [
            u('photo-1583394838336-acd977736f90', 200, 200),
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1607990281513-2c110a25bd8c', 200, 200),
        ],
        features: [
            u('photo-1555244162-803834f70033', 400, 300),
            u('photo-1498654896293-37aacf113fd9', 400, 300),
            u('photo-1414235077428-338989a2e8c0', 400, 300),
        ],
    },

    ecommerce: {
        hero: [
            u('photo-1441986300917-64674bd600d8', 1400, 800),
            u('photo-1556742049-0cfed4f6a45d', 1400, 800),
            u('photo-1483985988355-763728e1935b', 1400, 800),
            u('photo-1586880244406-556ebe35f282', 1400, 800), // warehouse
            u('photo-1472851294608-062f824d29cc', 1400, 800), // product display
        ],
        gallery: [
            u('photo-1523381210434-271e8be1f52b', 600, 600),
            u('photo-1445205170230-053b83016050', 600, 600),
            u('photo-1469334031218-e382a71b716b', 600, 600),
            u('photo-1558618666-fcd25c85f82e', 600, 600),
            u('photo-1556905055-8f358a7a47b2', 600, 600),
            u('photo-1490481651871-ab68de25d43d', 600, 600),
        ],
        about: u('photo-1441984904996-e0b6ba687e04', 800, 600),
        team: [
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1519085360753-af0119f7cbe7', 200, 200),
        ],
        features: [
            u('photo-1556742049-0cfed4f6a45d', 400, 300),
            u('photo-1441986300917-64674bd600d8', 400, 300),
            u('photo-1472851294608-062f824d29cc', 400, 300),
        ],
    },

    beauty: {
        hero: [
            u('photo-1560750588-73207b1ef5b8', 1400, 800),
            u('photo-1522335789203-aabd1fc54bc9', 1400, 800),
            u('photo-1570172619644-dfd03ed5d881', 1400, 800),
            u('photo-1487412912498-0447578fcca8', 1400, 800), // beauty products
            u('photo-1516975080664-ed2fc6a32937', 1400, 800), // hair salon
        ],
        gallery: [
            u('photo-1487412912498-0447578fcca8', 600, 600),
            u('photo-1596755389378-c31d21fd1273', 600, 600),
            u('photo-1519415943484-9fa1ff481d38', 600, 600),
            u('photo-1560750588-73207b1ef5b8', 600, 600),
            u('photo-1507003211169-0a1dd7228f2d', 600, 600),
            u('photo-1540555700478-4be289fbec6e', 600, 600),
        ],
        about: u('photo-1600334129128-685c5582fd35', 800, 600),
        team: [
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1534528741775-53994a69daeb', 200, 200),
            u('photo-1544005313-94ddf0286df2', 200, 200),
        ],
        features: [
            u('photo-1522335789203-aabd1fc54bc9', 400, 300),
            u('photo-1560750588-73207b1ef5b8', 400, 300),
            u('photo-1570172619644-dfd03ed5d881', 400, 300),
        ],
    },

    tech: {
        hero: [
            u('photo-1451187580459-43490279c0fa', 1400, 800),
            u('photo-1518770660439-4636190af475', 1400, 800),
            u('photo-1550751827-4bd374c3f58b', 1400, 800),
            u('photo-1558494949-ef010cbdcc31', 1400, 800), // server room
            u('photo-1512941937669-90a1b58e7e9c', 1400, 800), // mobile app
        ],
        gallery: [
            u('photo-1531297484001-80022131f5a1', 600, 600),
            u('photo-1519389950473-47ba0277781c', 600, 600),
            u('photo-1460925895917-afdab827c52f', 600, 600),
            u('photo-1504868584819-f8e8b4b6d7e3', 600, 600),
            u('photo-1535223289827-42f1e9919769', 600, 600),
            u('photo-1555949963-aa79dcee981c', 600, 600),
        ],
        about: u('photo-1497366216548-37526070297c', 800, 600),
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1507003211169-0a1dd7228f2d', 200, 200),
        ],
        features: [
            u('photo-1451187580459-43490279c0fa', 400, 300),
            u('photo-1518770660439-4636190af475', 400, 300),
            u('photo-1550751827-4bd374c3f58b', 400, 300),
        ],
    },

    health: {
        hero: [
            u('photo-1519494026892-80bbd2d6fd0d', 1400, 800),
            u('photo-1576091160399-112ba8d25d1d', 1400, 800),
            u('photo-1538108149393-fbbd81895907', 1400, 800),
            u('photo-1587854692152-cbe660dbde88', 1400, 800), // pharmacy
            u('photo-1519494080410-f9aa76cb4283', 1400, 800), // medical team
        ],
        gallery: [
            u('photo-1631217868264-e5b90bb7e133', 600, 600),
            u('photo-1579684385127-1ef15d508118', 600, 600),
            u('photo-1551190822-a9ce113d0d25', 600, 600),
            u('photo-1559757175-5700dde675bc', 600, 600),
            u('photo-1516549655169-df83a0774514', 600, 600),
            u('photo-1584820927498-cfe5211fd8bf', 600, 600),
        ],
        about: u('photo-1519494026892-80bbd2d6fd0d', 800, 600),
        team: [
            u('photo-1612349317150-e413f6a5b16d', 200, 200),
            u('photo-1559839734-2b71ea197ec2', 200, 200),
            u('photo-1582750433449-648ed127bb54', 200, 200),
            u('photo-1622253692010-333f2da6031d', 200, 200),
        ],
        features: [
            u('photo-1576091160399-112ba8d25d1d', 400, 300),
            u('photo-1538108149393-fbbd81895907', 400, 300),
            u('photo-1519494026892-80bbd2d6fd0d', 400, 300),
        ],
    },

    education: {
        hero: [
            u('photo-1523050854058-8df90110c9f1', 1400, 800),
            u('photo-1427504494785-3a9ca7044f45', 1400, 800),
            u('photo-1503676260728-1c00da094a0b', 1400, 800),
            u('photo-1523580846011-d3a5bc25702b', 1400, 800), // graduation
            u('photo-1532094349884-543bc11b234d', 1400, 800), // lab
        ],
        gallery: [
            u('photo-1524178232363-1fb2b075b655', 600, 600),
            u('photo-1523050854058-8df90110c9f1', 600, 600),
            u('photo-1509062522246-3755977927d7', 600, 600),
            u('photo-1497633762265-9d179a990aa6', 600, 600),
            u('photo-1580582932707-520aed937b7b', 600, 600),
            u('photo-1427504494785-3a9ca7044f45', 600, 600),
        ],
        about: u('photo-1562774053-701939374585', 800, 600),
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1544717305-2782549b5136', 200, 200),
        ],
        features: [],
    },

    realestate: {
        hero: [
            u('photo-1600596542815-ffad4c1539a9', 1400, 800),
            u('photo-1600585154340-be6161a56a0c', 1400, 800),
            u('photo-1512917774080-9991f1c4c750', 1400, 800),
            u('photo-1600607687939-ce8a6c25118c', 1400, 800), // condo exterior
            u('photo-1600566753190-17f0baa2a6c3', 1400, 800), // garden
        ],
        gallery: [
            u('photo-1600596542815-ffad4c1539a9', 600, 600),
            u('photo-1600585154340-be6161a56a0c', 600, 600),
            u('photo-1600607687939-ce8a6c25118c', 600, 600),
            u('photo-1600566753376-12c8ab7c5a97', 600, 600),
            u('photo-1600573472591-ee6e79bc1e8b', 600, 600),
            u('photo-1600585154526-990dced4db0d', 600, 600),
        ],
        about: u('photo-1600607687939-ce8a6c25118c', 800, 600),
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1519085360753-af0119f7cbe7', 200, 200),
        ],
        features: [],
    },

    fitness: {
        hero: [
            u('photo-1534438327276-14e5300c3a48', 1400, 800),
            u('photo-1571019613454-1cb2f99b2d8b', 1400, 800),
            u('photo-1517836357463-d25dfeac3438', 1400, 800),
            u('photo-1518611012118-696072aa579a', 1400, 800), // yoga class
            u('photo-1576678927484-cc907957088c', 1400, 800), // swimming
        ],
        gallery: [
            u('photo-1534438327276-14e5300c3a48', 600, 600),
            u('photo-1571019613454-1cb2f99b2d8b', 600, 600),
            u('photo-1517836357463-d25dfeac3438', 600, 600),
            u('photo-1518611012118-696072aa579a', 600, 600),
            u('photo-1540497077202-7c8a3999166f', 600, 600),
            u('photo-1576678927484-cc907957088c', 600, 600),
        ],
        about: u('photo-1534438327276-14e5300c3a48', 800, 600),
        team: [
            u('photo-1567013127542-490d757e51fc', 200, 200),
            u('photo-1594381898411-846e7d193883', 200, 200),
            u('photo-1571019614242-c5c5dee9f50b', 200, 200),
            u('photo-1548690312-e3b507d8c110', 200, 200),
        ],
        features: [],
    },

    creative: {
        hero: [
            u('photo-1558655146-9f40138edfeb', 1400, 800),
            u('photo-1561070791-2526d30994b5', 1400, 800),
            u('photo-1545235617-9465d2a55698', 1400, 800),
            u('photo-1452587925148-ce544e77e70d', 1400, 800), // photography
            u('photo-1513364776144-60967b0f800f', 1400, 800), // sketch
        ],
        gallery: [
            u('photo-1558655146-9f40138edfeb', 600, 600),
            u('photo-1561070791-2526d30994b5', 600, 600),
            u('photo-1494438639946-1ebd1d20bf85', 600, 600),
            u('photo-1513364776144-60967b0f800f', 600, 600),
            u('photo-1460925895917-afdab827c52f', 600, 600),
            u('photo-1545235617-9465d2a55698', 600, 600),
        ],
        about: u('photo-1522071820081-009f0129c71c', 800, 600),
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1534528741775-53994a69daeb', 200, 200),
        ],
        features: [],
    },

    business: {
        hero: [
            u('photo-1497366216548-37526070297c', 1400, 800),
            u('photo-1553877522-43269d4ea984', 1400, 800),
            u('photo-1521737711867-e3b97375f902', 1400, 800),
            u('photo-1486406146926-c627a92ad1ab', 1400, 800), // skyline
            u('photo-1556761175-4b46a572b786', 1400, 800), // boardroom
        ],
        gallery: [
            u('photo-1497366216548-37526070297c', 600, 600),
            u('photo-1553877522-43269d4ea984', 600, 600),
            u('photo-1521737711867-e3b97375f902', 600, 600),
            u('photo-1556761175-4b46a572b786', 600, 600),
            u('photo-1522202176988-66273c2fd55f', 600, 600),
            u('photo-1542744173-8e7e91415657', 600, 600),
        ],
        about: u('photo-1497366216548-37526070297c', 800, 600),
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1519085360753-af0119f7cbe7', 200, 200),
        ],
        features: [],
    },

    // ── NEW CATEGORIES ──────────────────────────────────────────────────────

    fnb: {
        hero: [
            u('photo-1559925393-8be0ec4767c8', 1400, 800), // café interior
            u('photo-1517433670267-08bbd4be890f', 1400, 800), // bakery display
            u('photo-1556679343-c7306c1976bc', 1400, 800), // bubble tea
            u('photo-1565123409695-7b5ef63a2efb', 1400, 800), // food truck
            u('photo-1551024506-0bccd828d307', 1400, 800), // dessert table
        ],
        gallery: [
            u('photo-1495474472287-4d71bcdd2085', 600, 600), // coffee
            u('photo-1509440159596-0249088772ff', 600, 600), // bread
            u('photo-1551024506-0bccd828d307', 600, 600), // cake
            u('photo-1556679343-c7306c1976bc', 600, 600), // drinks
            u('photo-1514066558159-fc8c737ef259', 600, 600), // pastry
            u('photo-1559925393-8be0ec4767c8', 600, 600), // café
        ],
        about: u('photo-1554118811-1e0d58224f24', 800, 600), // cozy café
        team: [
            u('photo-1583394838336-acd977736f90', 200, 200), // barista
            u('photo-1607990281513-2c110a25bd8c', 200, 200), // baker
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1544005313-94ddf0286df2', 200, 200),
        ],
        features: [
            u('photo-1495474472287-4d71bcdd2085', 400, 300),
            u('photo-1509440159596-0249088772ff', 400, 300),
            u('photo-1517433670267-08bbd4be890f', 400, 300),
        ],
    },

    events: {
        hero: [
            u('photo-1519167758481-83f550bb49b3', 1400, 800), // wedding venue
            u('photo-1540575467063-178a50e2fd60', 1400, 800), // corporate event
            u('photo-1530103862676-de8c9debad1d', 1400, 800), // birthday party
            u('photo-1519741497674-611481863552', 1400, 800), // ballroom
            u('photo-1464366400600-7168b8af9bc3', 1400, 800), // outdoor ceremony
        ],
        gallery: [
            u('photo-1519167758481-83f550bb49b3', 600, 600),
            u('photo-1511795409834-ef04bbd61622', 600, 600), // flower arrangement
            u('photo-1478146059778-26028b07395a', 600, 600), // dinner setup
            u('photo-1519741497674-611481863552', 600, 600),
            u('photo-1530103862676-de8c9debad1d', 600, 600),
            u('photo-1464366400600-7168b8af9bc3', 600, 600),
        ],
        about: u('photo-1505236858219-8359eb29e329', 800, 600), // event planning
        team: [
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1534528741775-53994a69daeb', 200, 200),
            u('photo-1544005313-94ddf0286df2', 200, 200),
        ],
        features: [
            u('photo-1519167758481-83f550bb49b3', 400, 300),
            u('photo-1540575467063-178a50e2fd60', 400, 300),
            u('photo-1530103862676-de8c9debad1d', 400, 300),
        ],
    },

    blog: {
        hero: [
            u('photo-1455390582262-044cdead277a', 1400, 800), // writing desk
            u('photo-1499750310107-5fef28a66643', 1400, 800), // laptop coffee
            u('photo-1471107340929-a87cd0f5b5f3', 1400, 800), // notebook pen
            u('photo-1507842217343-583bb7270b66', 1400, 800), // bookshelf
            u('photo-1486312338219-ce68d2c6f44d', 1400, 800), // macbook typing
        ],
        gallery: [
            u('photo-1455390582262-044cdead277a', 600, 600),
            u('photo-1499750310107-5fef28a66643', 600, 600),
            u('photo-1488190211105-8b0e65b80b4e', 600, 600), // phone reading
            u('photo-1434030216411-0b793f4b4173', 600, 600), // writing
            u('photo-1456324504439-367cee3b3c32', 600, 600), // workspace
            u('photo-1471107340929-a87cd0f5b5f3', 600, 600),
        ],
        about: u('photo-1522202176988-66273c2fd55f', 800, 600), // writers
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1534528741775-53994a69daeb', 200, 200),
            u('photo-1507003211169-0a1dd7228f2d', 200, 200),
        ],
        features: [
            u('photo-1455390582262-044cdead277a', 400, 300),
            u('photo-1499750310107-5fef28a66643', 400, 300),
            u('photo-1486312338219-ce68d2c6f44d', 400, 300),
        ],
    },

    travel: {
        hero: [
            u('photo-1476514525535-07fb3b4ae5f1', 1400, 800), // tropical beach
            u('photo-1464822759023-fed622ff2c3b', 1400, 800), // mountain
            u('photo-1528181304800-259b08848526', 1400, 800), // temple asia
            u('photo-1504598318550-17eba1008a68', 1400, 800), // street market
            u('photo-1507525428034-b723cf961d3e', 1400, 800), // island aerial
        ],
        gallery: [
            u('photo-1476514525535-07fb3b4ae5f1', 600, 600),
            u('photo-1464822759023-fed622ff2c3b', 600, 600),
            u('photo-1528181304800-259b08848526', 600, 600),
            u('photo-1504598318550-17eba1008a68', 600, 600),
            u('photo-1507525428034-b723cf961d3e', 600, 600),
            u('photo-1552733407-5d5c46c3bb3b', 600, 600), // sunset
        ],
        about: u('photo-1469854523086-cc02fe5d8800', 800, 600), // traveler
        team: [
            u('photo-1507003211169-0a1dd7228f2d', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1519085360753-af0119f7cbe7', 200, 200),
        ],
        features: [
            u('photo-1476514525535-07fb3b4ae5f1', 400, 300),
            u('photo-1464822759023-fed622ff2c3b', 400, 300),
            u('photo-1528181304800-259b08848526', 400, 300),
        ],
    },
}

export function getIndustryImages(category: string): IndustryImages {
    return IMAGE_LIBRARY[category] || IMAGE_LIBRARY.business
}

export function getHeroImage(category: string, index = 0): string {
    const images = getIndustryImages(category)
    return images.hero[index % images.hero.length] || images.hero[0]
}

export function getGalleryImages(category: string, count = 6): string[] {
    const images = getIndustryImages(category)
    return images.gallery.slice(0, count)
}

export function getTeamAvatar(category: string, index = 0): string {
    const images = getIndustryImages(category)
    return images.team[index % images.team.length] || images.team[0]
}

export function getAboutImage(category: string): string {
    return getIndustryImages(category).about
}
