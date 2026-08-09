import mongoose from "mongoose";
import User from "../models/User.js";

const PINCODE_REGEX = /^\d{6}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

// GET all addresses
export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      count: user.addresses.length,
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ADD address
export const addAddress = async (req, res) => {
  try {
    const { fullName, phone, street, city, state, pincode, isDefault } =
      req.body;

    // Validation
    if (!fullName || !phone || !street || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "All address fields are required",
      });
    }

    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-digit Indian phone number",
      });
    }

    if (!PINCODE_REGEX.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Pincode must be a valid 6-digit number",
      });
    }

    const user = await User.findById(req.user._id);

    const newAddress = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault: isDefault || false,
    };

    // Only one default address
    if (newAddress.isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    // If this is the first address, make it default
    if (user.addresses.length === 0) {
      newAddress.isDefault = true;
    }

    user.addresses.push(newAddress);

    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully.",
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE address
export const updateAddress = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const user = await User.findById(req.user._id);

    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const { fullName, phone, street, city, state, pincode, isDefault } =
      req.body;

    if (phone && !PHONE_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-digit Indian phone number",
      });
    }

    if (pincode && !PINCODE_REGEX.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Pincode must be a valid 6-digit number",
      });
    }

    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    if (fullName !== undefined) address.fullName = fullName.trim();
    if (phone !== undefined) address.phone = phone.trim();
    if (street !== undefined) address.street = street.trim();
    if (city !== undefined) address.city = city.trim();
    if (state !== undefined) address.state = state.trim();
    if (pincode !== undefined) address.pincode = pincode.trim();
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save();

    res.json({
      success: true,
      message: "Address updated successfully.",
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE address
export const deleteAddress = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const user = await User.findById(req.user._id);

    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault = address.isDefault;

    address.deleteOne();

    // If deleted address was default, promote the first remaining address
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully.",
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
