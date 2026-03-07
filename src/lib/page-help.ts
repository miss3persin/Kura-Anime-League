export type PageHelpContent = {
    title: string;
    summary: string;
    purpose: string;
    thingsYouCanDo: string[];
    howItWorks: string[];
    tips: string[];
    reminder: string;
};

type PageHelpMatcher = {
    match: (pathname: string) => boolean;
    content: PageHelpContent;
};

const PAGE_HELP_ENTRIES: PageHelpMatcher[] = [
    {
        match: (pathname) => pathname === "/",
        content: {
            title: "Home Guide",
            summary: "This page gives you the quickest snapshot of what is happening across the current or upcoming season.",
            purpose: "Use Home to understand the season at a glance before you jump into drafting, predictions, rankings, or team management.",
            thingsYouCanDo: [
                "Check featured anime, trend movement, and leaderboard highlights.",
                "See season timing, announcements, and the next important action.",
                "Jump straight into draft, rankings, or other key pages."
            ],
            howItWorks: [
                "The page pulls seasonal content from the current or next active season.",
                "Highlights update as show hype changes and site content is refreshed.",
                "Main cards act like a launchpad into the parts of KAL you want next."
            ],
            tips: [
                "If you are new, start here and then open Draft or My Team.",
                "If something looks unfamiliar, this help button is available on every page."
            ],
            reminder: "Need context? Open the help icon any time for a plain-language guide to this page."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/profile"),
        content: {
            title: "Profile Guide",
            summary: "Your profile is your season record, progress snapshot, and personal performance hub.",
            purpose: "Use this page to review how you are doing overall, what you have earned, and how your activity compares over time.",
            thingsYouCanDo: [
                "Review KP totals, achievements, league participation, and personal stats.",
                "Track how your account is progressing across the season.",
                "Use it as your personal scoreboard before making strategy changes elsewhere."
            ],
            howItWorks: [
                "Profile data is assembled from your account activity, league performance, and rewards.",
                "Stats and badges reflect what you have earned so far.",
                "Other pages change your results, while this page helps you read them."
            ],
            tips: [
                "If your score changes after a draft, transfer, or bet, refresh this page to confirm the update.",
                "Use this page to spot whether your current strategy is paying off."
            ],
            reminder: "If any stat or badge feels unclear, the help icon explains what this page is showing."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/squad"),
        content: {
            title: "My Team Guide",
            summary: "This page is where you manage your active anime lineup and supporting character picks.",
            purpose: "Use My Team to review your roster, set special roles, and make transfer decisions during the season.",
            thingsYouCanDo: [
                "See which anime and characters are currently on your team.",
                "Assign captain and vice-captain roles to boost strategy.",
                "Start transfers when you want to swap a show out for another one."
            ],
            howItWorks: [
                "Your roster is loaded from the current season team linked to your account.",
                "Role changes update your active lineup settings.",
                "Transfers replace one existing show with another available option from the market."
            ],
            tips: [
                "Captains and vice-captains matter, so review them before deadlines.",
                "Use Show Trends before transferring if you want a better read on momentum."
            ],
            reminder: "Not sure what a role or transfer does? The help icon on this page breaks it down."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/leagues"),
        content: {
            title: "Leagues Guide",
            summary: "Leagues are where you compete directly with other players in shared groups.",
            purpose: "Use this page to view your league spaces, compare standing, and understand where you rank against friends or the wider community.",
            thingsYouCanDo: [
                "See which leagues you belong to and how they are performing.",
                "Compare rank, score, and competition inside each league.",
                "Use league context to decide whether you need safer or riskier moves."
            ],
            howItWorks: [
                "League standings are based on the scoring activity tied to league members.",
                "As your roster and predictions perform, your league position can change.",
                "This page focuses on competition context rather than direct roster management."
            ],
            tips: [
                "Check this page after major scoring events to see rank movement.",
                "If you are behind, use Draft, Team, or Predictions to respond."
            ],
            reminder: "You can reopen this page guide whenever you need a quick explanation of league views or ranking sections."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/draft"),
        content: {
            title: "Draft Guide",
            summary: "Draft is where you build your roster by choosing the shows you want to back for the season.",
            purpose: "Use this page to spend KP wisely, assemble your core lineup, and shape your strategy before or during the season cycle.",
            thingsYouCanDo: [
                "Browse available shows and compare their cost and momentum.",
                "Pick anime that fit your budget and strategy.",
                "Build the roster you will later manage from My Team."
            ],
            howItWorks: [
                "Each show has a KP cost and a performance profile based on available data.",
                "Your budget limits how many premium picks you can take.",
                "Once drafted, those choices feed directly into your active squad."
            ],
            tips: [
                "Do not spend everything on one type of pick unless that is a deliberate risk.",
                "Compare Draft with Show Trends if you want a stronger signal before locking choices."
            ],
            reminder: "Need a refresher on drafting strategy or page sections? Open the help icon before making a pick."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/hype"),
        content: {
            title: "Show Trends Guide",
            summary: "Show Trends helps you read momentum so you can spot rising or falling anime before making decisions.",
            purpose: "Use this page to understand hype movement and compare which shows are gaining or losing attention.",
            thingsYouCanDo: [
                "Review trend movement across current or upcoming shows.",
                "Spot momentum shifts before drafting or transferring.",
                "Compare hype performance between multiple anime."
            ],
            howItWorks: [
                "Trend data is pulled from the platform's underlying anime data and refresh flow.",
                "Shows are usually ordered to make the biggest movers easier to see.",
                "This page is primarily for research and decision support."
            ],
            tips: [
                "Use rising shows to find upside and falling shows to spot risk.",
                "Trend movement is helpful context, not a guarantee of scoring."
            ],
            reminder: "If you are unsure how to read a trend card, the help icon explains this page in simple terms."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/predict"),
        content: {
            title: "Predictions Guide",
            summary: "Predictions lets you wager KP on specific anime outcomes and follow those bets over time.",
            purpose: "Use this page when you want to take calculated risks and earn more KP from outcome-based calls.",
            thingsYouCanDo: [
                "Browse upcoming prediction opportunities.",
                "Place bets using your available KP.",
                "Review active bets and check the outcome of past ones."
            ],
            howItWorks: [
                "Each prediction event has choices and a KP wager amount.",
                "When you place a bet, it moves into your active predictions.",
                "Resolved events later appear in your past history with the result."
            ],
            tips: [
                "Protect your balance by avoiding oversized bets unless the read is strong.",
                "Use filters to separate new opportunities from bets you already placed."
            ],
            reminder: "If betting terms or sections feel unclear, the help icon on this page explains the flow."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/rankings"),
        content: {
            title: "Rankings Guide",
            summary: "Rankings shows the broader leaderboard so you can see who is leading and where you stand.",
            purpose: "Use this page to compare performance across the platform and measure your progress against top players.",
            thingsYouCanDo: [
                "Review leaderboard positions and score totals.",
                "See who is climbing, holding, or falling behind.",
                "Use the leaderboard as feedback for your current strategy."
            ],
            howItWorks: [
                "Rankings are generated from player performance data and point totals.",
                "Movement happens as scoring updates are recorded.",
                "This page gives competitive context rather than direct actions."
            ],
            tips: [
                "Use rankings with your profile to understand both public and personal performance.",
                "If you want to improve position, head back to Draft, Team, or Predictions."
            ],
            reminder: "Need a quick explanation of leaderboard sections? The help icon is always available here."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/polls"),
        content: {
            title: "Polls Guide",
            summary: "Polls lets the community vote on featured questions and see how opinions stack up.",
            purpose: "Use this page to join community decisions, share your take, and understand the current vote picture.",
            thingsYouCanDo: [
                "Vote on available polls.",
                "See how current results are shaping up.",
                "Use poll activity as extra community context around the season."
            ],
            howItWorks: [
                "Each poll presents a question and a set of answer choices.",
                "Your vote is recorded and contributes to the running totals.",
                "Polls are for community participation, not direct roster scoring."
            ],
            tips: [
                "Treat polls as insight into community sentiment, not guaranteed outcomes.",
                "Check back later if you want to see how votes shifted."
            ],
            reminder: "If you want a simple explanation of what polls are for on this page, open the help icon."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/settings"),
        content: {
            title: "Settings Guide",
            summary: "Settings is where you control account preferences and how the platform behaves for you.",
            purpose: "Use this page to adjust your personal setup, notification choices, and other account-level options.",
            thingsYouCanDo: [
                "Update account preferences.",
                "Manage notification-related options.",
                "Review and control how KAL communicates with you."
            ],
            howItWorks: [
                "Changes made here affect your account experience across the app.",
                "Some settings update immediately after you save them.",
                "This page is for preferences, not gameplay decisions."
            ],
            tips: [
                "If you are missing alerts, check notification-related settings first.",
                "Use this page after sign-in if you want the app to feel more tailored."
            ],
            reminder: "Any time a settings section feels technical, open the help icon for a simple explanation."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/support"),
        content: {
            title: "Support Guide",
            summary: "This page explains ways to support KAL and help fund continued development.",
            purpose: "Use this page if you want to contribute to the project and understand what support options are available.",
            thingsYouCanDo: [
                "Review support tiers or contribution options.",
                "Understand what supporting the platform helps fund.",
                "Choose whether you want to contribute now or later."
            ],
            howItWorks: [
                "Support options are presented as contribution tiers or direct actions.",
                "This page is optional and separate from gameplay features.",
                "You can leave and return here whenever you want."
            ],
            tips: [
                "Nothing on this page is required to use the platform.",
                "If you support later, the rest of KAL still works the same."
            ],
            reminder: "If you want quick clarity on what this page is for, the help icon summarizes it."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/admin"),
        content: {
            title: "Admin Guide",
            summary: "This page is the platform control center for user access, KP, homepage content, season operations, polls, and admin activity logs.",
            purpose: "Use Admin to run live platform operations without editing code or touching the database directly, as long as your account has admin access.",
            thingsYouCanDo: [
                "Promote or demote users, change KP balances, suspend accounts, and set email-based access defaults for future sign-ins.",
                "Edit homepage hero content, announcements, and display toggles that affect what users see across the app.",
                "Run season automation, update season dates, create or edit polls, and review recent admin actions."
            ],
            howItWorks: [
                "Each section writes through protected admin APIs, so saved changes can affect live platform behavior immediately.",
                "User updates sync account access and stored profile data together, while email grants define defaults for people who sign up later.",
                "Logs at the bottom give you a recent audit trail so you can confirm what changed and when."
            ],
            tips: [
                "Use the user search first if you are looking for one person, then update role, KP, or suspension from the selected user card.",
                "Treat email-based access defaults carefully because they can grant admin access to future signups that match that address exactly."
            ],
            reminder: "This page changes live platform behavior, so open this guide whenever you need a quick explanation before saving admin updates."
        }
    },
    {
        match: (pathname) => pathname.startsWith("/login"),
        content: {
            title: "Login Guide",
            summary: "This page is how you access your account and unlock player-specific features.",
            purpose: "Use Login when you need to sign in, create access, or return to your saved KAL progress.",
            thingsYouCanDo: [
                "Sign in to an existing account.",
                "Start the process for account access.",
                "Unlock protected pages like My Team, Predictions, and Settings."
            ],
            howItWorks: [
                "Authentication verifies your account and starts a user session.",
                "After sign-in, protected areas become available based on your access.",
                "If you leave this page, you can always return to sign in later."
            ],
            tips: [
                "If a page tells you to log in, come back here first.",
                "Once signed in, re-open the page you originally wanted."
            ],
            reminder: "Need a simple explanation of the sign-in flow? The help icon on this page covers it."
        }
    }
];

const DEFAULT_PAGE_HELP: PageHelpContent = {
    title: "Page Guide",
    summary: "This page has its own help panel so you can quickly understand what it is for and how to use it.",
    purpose: "Use the help panel whenever you want a plain-language explanation of the current screen.",
    thingsYouCanDo: [
        "Understand the purpose of the page.",
        "See the main actions available here.",
        "Get a quick reminder without leaving your current flow."
    ],
    howItWorks: [
        "The help content changes automatically based on the page you are on.",
        "You can reopen it at any time from the question-mark button.",
        "The reminder near the top of the page points you back here when needed."
    ],
    tips: [
        "If you get stuck, open the help panel before leaving the page.",
        "The guide is meant to be short, practical, and easy to scan."
    ],
    reminder: "Need a quick explanation of this page? Use the help icon any time."
};

export function getPageHelp(pathname: string | null): PageHelpContent {
    if (!pathname) {
        return DEFAULT_PAGE_HELP;
    }

    const matchedEntry = PAGE_HELP_ENTRIES.find((entry) => entry.match(pathname));
    return matchedEntry?.content ?? DEFAULT_PAGE_HELP;
}
