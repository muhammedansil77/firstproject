import Address from "../models/Address.js";
import Image from "../models/image.js";



export const addAddress = async (req, res) => {
  try {
    await Address.create({
      userId: req.session.userId,
      fullName: req.body.fullName,
      phone: req.body.phone,
      alternatePhone: req.body.alternatePhone || "",
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      postalCode: req.body.postalCode,
      country: req.body.country,
      addressType: req.body.addressType,
      isDefault: req.body.isDefault === "on"
    });

    res.redirect("/user/address");
  } catch (err) {
    console.error(err);
    res.redirect("/user/address");
  }
};


export const editAddress = async (req, res) => {
  try {
    await Address.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      {
        fullName: req.body.fullName,
        phone: req.body.phone,
        alternatePhone: req.body.alternatePhone || "",
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        country: req.body.country,
        addressType: req.body.addressType,
        isDefault: req.body.isDefault === "on"
      }
    );

    res.redirect("/user/address");
  } catch (err) {
    console.error(err);
    res.redirect("/user/address");
  }
};
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;

    // clear all defaults
    await Address.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );

    // set selected default
    await Address.updateOne(
      { _id: addressId, userId },
      { $set: { isDefault: true } }
    );

    res.redirect("/user/address");
  } catch (err) {
    console.error(err);
    res.redirect("/user/address");
  }
};



export const deleteAddress = async (req, res) => {
  try {
    await Address.deleteOne({
      _id: req.params.id,
      userId: req.session.userId
    });

    res.redirect("/user/address");
  } catch (err) {
    console.error(err);
    res.redirect("/user/address");
  }
};


export const loadAddresses = async (req, res) => {
  const addresses = await Address.find({ userId: req.session.userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  res.render("user/pages/address-management", {
    addresses,
    pageJs: "address.js"
  });
};
export const showUploadPage = async (req, res) => {
  const images = (await Image.find()).toSorted({ cretedAt: -1 }).lean();
  res.render("user/pages/image", { images })
}
export const uploadImage = async (req, res) => {
  try {
    await Image.create({
      title: req.body.title,
      imagePath: "/uploads" + req.file.filename
    })
    res.redirect("/user/address/upload-image")

  } catch (err) {

  }
}