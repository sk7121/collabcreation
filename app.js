require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const passport = require("passport");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const multer = require("multer");

// const upload = multer({
//     storage: multer.diskStorage({
//         destination: (req, file, cb) => {
//             cb(null, "uploads/");
//         },
//         filename: (req, file, cb) => {
//             cb(null, Date.now() + "-" + file.originalname);
//         }
//     })
// });

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* =======================
   MODELS
======================= */
const User = require("./models/User");
const CreatorProfile = require("./models/creator");
const BrandProfile = require("./models/brand");
const Project = require("./models/project");
const Application = require("./models/application");
const Chat = require("./models/chat");
const Message = require("./models/message");
const application = require("./models/application");

/* =======================
   DATABASE
======================= */
mongoose
    .connect(process.env.ATLASDB_URL)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ DB Error:", err));

/* =======================
   APP CONFIG
======================= */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

/* =======================
   SESSION
======================= */
app.set("trust proxy", 1);

app.use(express.static(path.join(__dirname, "public")));
app.use(
    session({
        name: "collabcreation-session",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.ATLASDB_URL,
            collectionName: "sessions"
        }),
        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);
app.use(flash());

/* =======================
   PASSPORT CONFIG
======================= */


app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new LocalStrategy(
        { usernameField: "email" },
        async (email, password, done) => {
            try {
                const user = await User.findOne({ email });

                if (!user) {
                    return done(null, false, { message: "User not found" });
                }

                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return done(null, false, { message: "Incorrect password" });
                }

                return done(null, user);

            } catch (err) {
                return done(err);
            }
        }
    )
);


passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

/* =======================
   GLOBAL MIDDLEWARE
======================= */
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

/* =======================
   AUTH MIDDLEWARE
======================= */
const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) return res.redirect("/login");
    next();
};

const isCreator = (req, res, next) => {
    if (req.user.role !== "creator") return res.redirect("/");
    next();
};

const isBrand = (req, res, next) => {
    if (req.user.role !== "brand") return res.redirect("/");
    next();
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") return res.redirect("/");
    next();
};

/* =======================
   AUTH ROUTES
======================= */
app.get("/", (req, res) => {
    res.redirect("/login");
});

app.get("/login", (req, res) => {

    if (!req.isAuthenticated()) {
        return res.render("auth/login");
    }

    if (req.user.role === "creator") {
        return res.redirect("/creator/dashboard");
    }

    if (req.user.role === "brand") {
        return res.redirect("/brand/dashboard");
    }

    res.redirect("/");
});



app.get("/register", (req, res) => {
    res.render("auth/register");
});



app.post("/register", async (req, res) => {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
        console.log("error", "Email already exists");
        return res.redirect("/register");
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hash, role });

    req.login(user, () => {
        if (role === "creator") return res.redirect("/creator/onboarding");
        if (role === "brand") return res.redirect("/brand/onboarding");
    });
});

app.post(
    "/login",
    passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true
    }),
    (req, res) => {
        if (req.user.role === "creator") return res.redirect("/creator/dashboard");
        if (req.user.role === "brand") return res.redirect("/brand/dashboard");
    }
);


app.get("/admin/login", (req, res) => {
    res.render("auth/admin-login");
});


app.post(
    "/admin/login",
    passport.authenticate("local", {
        failureRedirect: "/admin/login",
        failureFlash: true
    }),
    (req, res) => {
        if (req.user.role !== "admin") return res.redirect("/login");
        res.redirect("/admin/dashboard");
    }
);



app.get("/logout", (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect("/login");
    });
});



/* =======================
   ADMIN ROUTES
======================= */
app.get("/admin/dashboard", isLoggedIn, isAdmin, async (req, res) => {
    const unverifiedUsers = await User.find({ role: "creator", isOnboarded: true, isVerified: false });
    res.render("admin/dashboard", { unverifiedUsers });
});

app.get(
    "/admin/creator/details/:userId",
    isLoggedIn,
    isAdmin,
    async (req, res) => {
        try {
            const user = await User.findById(req.params.userId);

            if (!user || user.role !== "creator") {
                console.log("Creator not found");
                return res.redirect("/admin/dashboard");
            }

            const creator = await CreatorProfile.findOne({ user: user._id });

            if (!creator) {
                console.log("Creator profile not found");
                return res.redirect("/admin/dashboard");
            }

            res.render("admin/creator-details", { creator, user });
        } catch (err) {
            console.error(err);
            res.redirect("/admin/dashboard");
        }
    }
);


app.get("/admin/creator/verify/:userId", isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);

        if (!user) {
            console.log("Creator not found");
            return res.redirect("/admin/dashboard");
        }

        if (user.role !== "creator") {
            console.log("User is not a creator");
            return res.redirect("/admin/dashboard");
        }

        user.isVerified = true;
        await user.save();

        res.redirect("/admin/dashboard");
    } catch (err) {
        console.error(err);
        res.redirect("/admin/dashboard");
    }
});




/* =======================
   CREATOR ROUTES
======================= */
app.get("/creator/onboarding", isLoggedIn, isCreator, (req, res) => {
    res.render("creator/onboarding");
});


app.post(
    "/creator/onboarding",
    isLoggedIn,
    isCreator,
    // upload.single("firstReel"),   // ✅ COMMENTED ONLY
    async (req, res) => {

        // if (!req.file) {
        //     console.log("error", "First reel is required");
        //     return res.redirect("back");
        // }

        await CreatorProfile.create({
            user: req.user._id,
            bio: req.body.bio,

            skills: req.body.skills
                .split(",")
                .map(s => s.trim())
                .filter(Boolean),

            portfolioLinks: Array.isArray(req.body.portfolio)
                ? req.body.portfolio.filter(p => p && p.trim() !== "")
                : [],

            socialLinks: {
                instagram: req.body.instagram,
                youtube: req.body.youtube,
                // tiktok: req.body.tiktok   // ✅ COMMENTED ONLY
            },

            kyc: {
                aadhaar: req.body.aadhaar,
                pan: req.body.pan,
                bankAccount: req.body.bankAccount
            },

            // firstReel: req.file.path   // ✅ COMMENTED ONLY
        });

        req.user.isOnboarded = true;
        await req.user.save();

        res.redirect("/creator/dashboard");
    }
);



app.get("/creator/dashboard", isLoggedIn, isCreator, async (req, res) => {

    const creator = await CreatorProfile.findOne({ user: req.user._id });

    if (!creator) {
        return res.redirect("/creator/onboarding");
    }


    const applications = await Application
        .find({ creator: creator._id })
        .populate({
            path: "project",
            populate: {
                path: "assignedcreator"
            }
        })
        .sort({ createdAt: -1 });


    const validApplications = applications.filter(app => app.project);

    const appliedProjectIds = validApplications.map(app => app.project._id);

    const remainings = await Project.find({
        status: "open",
        _id: { $nin: appliedProjectIds }
    });

    res.render("creator/dashboard", {
        user: req.user,
        applications: validApplications,
        remainings,
        creator
    });
});






/* =======================
   BRAND ROUTES
======================= */
app.get("/brand/onboarding", isLoggedIn, isBrand, (req, res) => {
    res.render("brand/onboarding");
});

app.post("/brand/onboarding", isLoggedIn, isBrand, async (req, res) => {
    await BrandProfile.create({
        user: req.user._id,
        companyName: req.body.companyName,
        address: req.body.address
    });

    req.user.isOnboarded = true;
    await req.user.save();

    res.redirect("/brand/dashboard");
});

app.get("/brand/dashboard", isLoggedIn, isBrand, async (req, res) => {
    const projects = await Project.find({ user: req.user._id }).sort({ _id: -1 });
    res.render("brand/dashboard", { projects });
});


/* =======================
   PROJECT ROUTES
======================= */
app.get("/brand/projects/new", isLoggedIn, isBrand, (req, res) => {
    res.render("projects/create");
});



app.get("/brand/projects/:id", isLoggedIn, isBrand, async (req, res) => {
    try {
        let project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).send("Project not found");
        }

        if (project.status === "assigned") {
            project = await Project.findById(req.params.id)
                .populate({
                    path: "assignedcreator",
                    populate: {
                        path: "user"
                    }
                })
                .populate({
                    path: "assignedbrand",
                    populate: {
                        path: "user"
                    }
                });
        }

        const applications = await Application.find({ project: req.params.id })
            .populate({
                path: "creator",
                populate: {
                    path: "user"
                }
            });

        // Remove broken creators
        const creators = applications
            .map(app => app.creator)
            .filter(creator => creator && creator.user);

        res.render("brand/project", { creators, project });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


app.post("/projects", isLoggedIn, isBrand, async (req, res) => {
    try {
        const project = await Project.create({
            user: req.user._id,
            title: req.body.title,
            description: req.body.description,
            skillsRequired: req.body.skills.split(",").map(skill => skill.trim()),
            budget: req.body.budget,
            deadline: req.body.deadline
        });

        if (!project) {
            console.log("Project not created");
            return res.redirect("/brand/dashboard");
        }

        res.redirect("/brand/dashboard");

    } catch (err) {
        console.error("Error creating project:", err);
        res.status(500).send("Something went wrong");
    }
});


app.get("/projects/:id", isLoggedIn, async (req, res) => {
    const project = await Project.findById(req.params.id);
    res.render("projects/apply", { project });
});

app.post("/projects/:id/apply", isLoggedIn, isCreator, async (req, res) => {
    const creator = await CreatorProfile.findOne({ user: req.user._id });
    await Application.create({
        project: req.params.id,
        creator: creator._id,
        pitch: req.body.pitch
    });

    console.log("success", "Application submitted");

    res.redirect("/creator/dashboard");
});


app.get("/brand/project/assign/:projectId/:creatorId", isLoggedIn, isBrand, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);

        if (!project) {
            return res.status(404).send("Project not found");
        }

        // Prevent re-assigning
        if (project.status !== "open") {
            return res.status(400).send("Project is not open for assignment");
        }

        const brand = await BrandProfile.findOne({ user: req.user._id });

        if (!brand) {
            return res.status(403).send("Brand profile not found");
        }

        // Optional: verify this brand owns the project
        if (project.user.toString() !== req.user._id.toString()) {
            return res.status(403).send("Unauthorized");
        }

        project.assignedcreator = req.params.creatorId;
        project.assignedbrand = brand._id;
        project.status = "assigned";

        await project.save();

        res.redirect(`/brand/projects/${req.params.projectId}`);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});


app.get("/brand/project/unassign/:projectId/:creatorId", isLoggedIn, isBrand, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);

        if (!project) {
            return res.status(404).send("Project not found");
        }

        // Optional security check:
        // Make sure this brand owns the project
        if (!project.assignedbrand || !project.assignedbrand) {
            return res.status(403).send("Unauthorized");
        }

        project.assignedcreator = null;
        project.assignedbrand = null;
        project.status = "open";

        await project.save();

        res.redirect(`/brand/projects/${req.params.projectId}`);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});


/* =====================
    CHAT ROUTES
======================= */

app.get("/brand/creator/chat/:projectId/:creatorId", isLoggedIn, async (req, res) => {
    try {
        if (!["creator", "brand"].includes(req.user.role)) {
            return res.redirect("/");
        }

        const project = await Project.findById(req.params.projectId);
        if (!project) return res.redirect("/");

        const creator = await CreatorProfile.findById(req.params.creatorId);
        if (!creator) return res.redirect("/");

        const brand = await BrandProfile.findOne({ user: project.user });
        if (!brand) return res.redirect("/");

        let chat = await Chat.findOne({
            project: project._id,
            creator: creator._id,
            brand: brand._id
        });

        if (!chat) {
            chat = await Chat.create({
                project: project._id,
                creator: creator._id,
                brand: brand._id
            });

            project.chat = chat._id;
            await project.save();
        }

        const messages = await Message.find({ chat: chat._id })
            .populate("sender")
            .sort({ createdAt: 1 });

        if (req.user.role === "creator") {
            return res.render("creator/creatorChat", { project, messages, creatorId: creator._id });
        } else {
            return res.render("brand/brandChat", { project, messages, creatorId: creator._id });
        }

    } catch (error) {
        console.error("Error in chat GET route:", error);
        res.redirect("/");
    }
});



app.post("/brand/creator/chat/:projectId/:creatorId", isLoggedIn, async (req, res) => {
    try {
        if (!["creator", "brand"].includes(req.user.role)) {
            return res.redirect("/");
        }

        const project = await Project.findById(req.params.projectId);
        if (!project) return res.redirect("/");

        const creator = await CreatorProfile.findById(req.params.creatorId);
        if (!creator) return res.redirect("/");

        let brand;

        if (req.user.role === "brand") {
            brand = await BrandProfile.findOne({ user: req.user._id });

            // Ensure brand owns the project
            if (!project.user.equals(req.user._id)) {
                return res.redirect("/");
            }
        } else {
            brand = await BrandProfile.findOne({ user: project.user });
        }

        if (!brand) return res.redirect("/");

        let chat = await Chat.findOne({
            project: project._id,
            creator: creator._id,
            brand: brand._id
        });

        if (!chat) {
            chat = await Chat.create({
                project: project._id,
                creator: creator._id,
                brand: brand._id
            });

            project.chat = chat._id;
            await project.save();
        }

        if (!req.body.message?.trim()) {
            return res.redirect(`/brand/creator/chat/${req.params.projectId}/${req.params.creatorId}`);
        }

        await Message.create({
            chat: chat._id,
            sender: req.user._id,
            content: req.body.message.trim()
        });

        res.redirect(`/brand/creator/chat/${req.params.projectId}/${req.params.creatorId}`);
    } catch (error) {
        console.error("Chat POST error:", error);
        res.redirect(`/brand/creator/chat/${req.params.projectId}/${req.params.creatorId}`);
    }
});








/* =======================
   SERVER
======================= */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 CollabCreation running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
