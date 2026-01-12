import User from "../../models/userSchema.js";

const preventBlocked = async (req, res, next) => {
  try {
 
    if (req.session?.adminLoggedIn) {
      return next();
    }

   
    if (!req.session?.userId) {
      return next();
    }

    const user = await User.findById(req.session.userId).select("isBlocked");

    if (!user || user.isBlocked) {
      console.warn("🚫 Blocked user detected:", req.session.userId);

      return req.session.destroy(() => {
     
        if (req.xhr || req.headers.accept?.includes("application/json")) {
          return res.status(404).json({ blocked: true });
        }

        return res.status(404).render("user/pages/page-404", {
          layout: "user/layouts/main"
        });
      });
    }

    return next();
  } catch (err) {
    console.error("preventBlocked error:", err);
    return res.status(404).render("user/pages/page-404", {
      layout: "user/layouts/main"
    });
  }
};

export default preventBlocked;
