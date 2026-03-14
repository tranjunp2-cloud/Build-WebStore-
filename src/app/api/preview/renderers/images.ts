/**
 * Curated Unsplash image library per industry.
 * Uses direct Unsplash Source URLs — no API key required.
 * All images are royalty-free and optimized for web.
 */

export interface IndustryImages {
    hero: string[]       // Full-width hero backgrounds
    gallery: string[]    // Gallery/portfolio photos
    about: string        // About section image
    team: string[]       // Team member avatars
    features: string[]   // Feature illustrations
}

// Helper to build optimized Unsplash URLs
function u(id: string, w = 800, h = 600): string {
    return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`
}

const IMAGE_LIBRARY: Record<string, IndustryImages> = {
    restaurant: {
        hero: [
            u('photo-1517248135467-4c7edcad34c4', 1400, 800), // elegant restaurant interior
            u('photo-1414235077428-338989a2e8c0', 1400, 800), // plated food
            u('photo-1559339352-11d035aa65de', 1400, 800), // chef cooking
        ],
        gallery: [
            u('photo-1504674900247-0877df9cc836', 600, 600), // food plating
            u('photo-1476224203421-9ac39bcb3327', 600, 600), // pasta
            u('photo-1565299624946-b28f40a0ae38', 600, 600), // pizza
            u('photo-1540189549336-e6e99c3679fe', 600, 600), // dessert
            u('photo-1551218808-94e220e084d2', 600, 600), // drinks
            u('photo-1555396273-367ea4eb4db5', 600, 600), // interior
        ],
        about: u('photo-1466978913421-dad2ebd01d17', 800, 600), // cozy restaurant
        team: [
            u('photo-1583394838336-acd977736f90', 200, 200), // chef
            u('photo-1560250097-0b93528c311a', 200, 200), // manager
            u('photo-1573497019940-1c28c88b4f3e', 200, 200), // staff
        ],
        features: [
            u('photo-1555244162-803834f70033', 400, 300),
            u('photo-1498654896293-37aacf113fd9', 400, 300),
            u('photo-1414235077428-338989a2e8c0', 400, 300),
        ],
    },

    ecommerce: {
        hero: [
            u('photo-1441986300917-64674bd600d8', 1400, 800), // fashion store
            u('photo-1556742049-0cfed4f6a45d', 1400, 800), // shopping bags
            u('photo-1483985988355-763728e1935b', 1400, 800), // fashion model
        ],
        gallery: [
            u('photo-1523381210434-271e8be1f52b', 600, 600), // clothing
            u('photo-1445205170230-053b83016050', 600, 600), // accessories
            u('photo-1469334031218-e382a71b716b', 600, 600), // fashion
            u('photo-1558618666-fcd25c85f82e', 600, 600), // shoes
            u('photo-1556905055-8f358a7a47b2', 600, 600), // outfit
            u('photo-1490481651871-ab68de25d43d', 600, 600), // jewelry
        ],
        about: u('photo-1441984904996-e0b6ba687e04', 800, 600), // fashion studio
        team: [
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
        ],
        features: [
            u('photo-1556742049-0cfed4f6a45d', 400, 300),
            u('photo-1441986300917-64674bd600d8', 400, 300),
            u('photo-1472851294608-062f824d29cc', 400, 300),
        ],
    },

    beauty: {
        hero: [
            u('photo-1560750588-73207b1ef5b8', 1400, 800), // spa interior
            u('photo-1522335789203-aabd1fc54bc9', 1400, 800), // beauty treatment
            u('photo-1570172619644-dfd03ed5d881', 1400, 800), // skincare
        ],
        gallery: [
            u('photo-1487412912498-0447578fcca8', 600, 600), // beauty products
            u('photo-1596755389378-c31d21fd1273', 600, 600), // skincare
            u('photo-1519415943484-9fa1ff481d38', 600, 600), // makeup
            u('photo-1560750588-73207b1ef5b8', 600, 600), // spa
            u('photo-1507003211169-0a1dd7228f2d', 600, 600), // treatment
            u('photo-1540555700478-4be289fbec6e', 600, 600), // nails
        ],
        about: u('photo-1600334129128-685c5582fd35', 800, 600), // spa room
        team: [
            u('photo-1580489944761-15a19d654956', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1534528741775-53994a69daeb', 200, 200),
        ],
        features: [
            u('photo-1522335789203-aabd1fc54bc9', 400, 300),
            u('photo-1560750588-73207b1ef5b8', 400, 300),
            u('photo-1570172619644-dfd03ed5d881', 400, 300),
        ],
    },

    tech: {
        hero: [
            u('photo-1451187580459-43490279c0fa', 1400, 800), // digital globe
            u('photo-1518770660439-4636190af475', 1400, 800), // circuit board
            u('photo-1550751827-4bd374c3f58b', 1400, 800), // code screen
        ],
        gallery: [
            u('photo-1531297484001-80022131f5a1', 600, 600), // laptops
            u('photo-1519389950473-47ba0277781c', 600, 600), // team working
            u('photo-1460925895917-afdab827c52f', 600, 600), // dashboard
            u('photo-1504868584819-f8e8b4b6d7e3', 600, 600), // workspace
            u('photo-1535223289827-42f1e9919769', 600, 600), // data
            u('photo-1555949963-aa79dcee981c', 600, 600), // coding
        ],
        about: u('photo-1497366216548-37526070297c', 800, 600), // modern office
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
        ],
        features: [
            u('photo-1451187580459-43490279c0fa', 400, 300),
            u('photo-1518770660439-4636190af475', 400, 300),
            u('photo-1550751827-4bd374c3f58b', 400, 300),
        ],
    },

    health: {
        hero: [
            u('photo-1519494026892-80bbd2d6fd0d', 1400, 800), // hospital
            u('photo-1576091160399-112ba8d25d1d', 1400, 800), // doctor
            u('photo-1538108149393-fbbd81895907', 1400, 800), // medical
        ],
        gallery: [
            u('photo-1631217868264-e5b90bb7e133', 600, 600), // clinic
            u('photo-1579684385127-1ef15d508118', 600, 600), // stethoscope
            u('photo-1551190822-a9ce113d0d25', 600, 600), // patient
            u('photo-1559757175-5700dde675bc', 600, 600), // dental
            u('photo-1516549655169-df83a0774514', 600, 600), // lab
            u('photo-1584820927498-cfe5211fd8bf', 600, 600), // equipment
        ],
        about: u('photo-1519494026892-80bbd2d6fd0d', 800, 600), // hospital
        team: [
            u('photo-1612349317150-e413f6a5b16d', 200, 200),
            u('photo-1559839734-2b71ea197ec2', 200, 200),
            u('photo-1582750433449-648ed127bb54', 200, 200),
        ],
        features: [
            u('photo-1576091160399-112ba8d25d1d', 400, 300),
            u('photo-1538108149393-fbbd81895907', 400, 300),
            u('photo-1519494026892-80bbd2d6fd0d', 400, 300),
        ],
    },

    education: {
        hero: [
            u('photo-1523050854058-8df90110c9f1', 1400, 800), // university
            u('photo-1427504494785-3a9ca7044f45', 1400, 800), // students
            u('photo-1503676260728-1c00da094a0b', 1400, 800), // library
        ],
        gallery: [
            u('photo-1524178232363-1fb2b075b655', 600, 600), // classroom
            u('photo-1523050854058-8df90110c9f1', 600, 600), // campus
            u('photo-1509062522246-3755977927d7', 600, 600), // study
            u('photo-1497633762265-9d179a990aa6', 600, 600), // books
            u('photo-1580582932707-520aed937b7b', 600, 600), // learning
            u('photo-1427504494785-3a9ca7044f45', 600, 600), // students
        ],
        about: u('photo-1562774053-701939374585', 800, 600), // campus
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
        ],
        features: [],
    },

    realestate: {
        hero: [
            u('photo-1600596542815-ffad4c1539a9', 1400, 800), // luxury house
            u('photo-1600585154340-be6161a56a0c', 1400, 800), // modern interior
            u('photo-1512917774080-9991f1c4c750', 1400, 800), // apartment
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
        ],
        features: [],
    },

    fitness: {
        hero: [
            u('photo-1534438327276-14e5300c3a48', 1400, 800), // gym
            u('photo-1571019613454-1cb2f99b2d8b', 1400, 800), // workout
            u('photo-1517836357463-d25dfeac3438', 1400, 800), // weights
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
        ],
        features: [],
    },

    creative: {
        hero: [
            u('photo-1558655146-9f40138edfeb', 1400, 800), // design studio
            u('photo-1561070791-2526d30994b5', 1400, 800), // abstract art
            u('photo-1545235617-9465d2a55698', 1400, 800), // creative workspace
        ],
        gallery: [
            u('photo-1558655146-9f40138edfeb', 600, 600),
            u('photo-1561070791-2526d30994b5', 600, 600),
            u('photo-1494438639946-1ebd1d20bf85', 600, 600),
            u('photo-1513364776144-60967b0f800f', 600, 600),
            u('photo-1460925895917-afdab827c52f', 600, 600),
            u('photo-1545235617-9465d2a55698', 600, 600),
        ],
        about: u('photo-1522071820081-009f0129c71c', 800, 600), // team brainstorm
        team: [
            u('photo-1560250097-0b93528c311a', 200, 200),
            u('photo-1573497019940-1c28c88b4f3e', 200, 200),
            u('photo-1580489944761-15a19d654956', 200, 200),
        ],
        features: [],
    },

    business: {
        hero: [
            u('photo-1497366216548-37526070297c', 1400, 800), // office
            u('photo-1553877522-43269d4ea984', 1400, 800), // meeting
            u('photo-1521737711867-e3b97375f902', 1400, 800), // team
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
        ],
        features: [],
    },
}

/** Get curated images for an industry category */
export function getIndustryImages(category: string): IndustryImages {
    return IMAGE_LIBRARY[category] || IMAGE_LIBRARY.business
}

/** Get a hero image URL for a category */
export function getHeroImage(category: string, index = 0): string {
    const images = getIndustryImages(category)
    return images.hero[index % images.hero.length] || images.hero[0]
}

/** Get gallery images for a category */
export function getGalleryImages(category: string, count = 6): string[] {
    const images = getIndustryImages(category)
    return images.gallery.slice(0, count)
}

/** Get a team member avatar */
export function getTeamAvatar(category: string, index = 0): string {
    const images = getIndustryImages(category)
    return images.team[index % images.team.length] || images.team[0]
}

/** Get the about section image */
export function getAboutImage(category: string): string {
    return getIndustryImages(category).about
}
