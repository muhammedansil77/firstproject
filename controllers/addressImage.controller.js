import { processVariantImage } from '../middlewares/upload.js';

export const uploadImagePage = async (req, res) => {
  res.render('user/pages/image', {
    imageUrl: null
  });
};

export const uploadImagePost = async (req, res) => {
  try {
    if (!req.file) {
      return res.render('user/pages/image', {
        imageUrl: null
      });
    }


    const imageUrl = await processVariantImage(req.file);

    res.render('user/pages/image', {
      imageUrl
    });
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).send('Image upload failed');
  }
};
