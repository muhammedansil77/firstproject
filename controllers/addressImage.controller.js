import Image from "../models/image.js";

/* SHOW PAGE */
export const showUploadPage = async (req, res) => {
  const images = await Image.find().sort({ createdAt: -1 }).lean();
  res.render("user/pages/image", { images });
};

/* HANDLE UPLOAD */
export const uploadImage = async (req, res) => {
  try {
    await Image.create({
      title: req.body.title,
      imagePath: "/uploads/" + req.file.filename
    });

    res.redirect("/upload-image");
  } catch (err) {
    console.error(err);
    res.redirect("/upload-image");
  }
};
