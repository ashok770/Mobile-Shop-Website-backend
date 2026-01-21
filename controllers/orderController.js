import Order from "../models/Order.js";
import Product from "../models/Product.js";

// CREATE order (Public)
export const createOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items in order" });
    }

    // 1) Validate stock for each item
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Only ${product.stock} left for ${product.name}`,
        });
      }
    }

    // 2) Reduce stock with conditional updates to avoid negative stock
    const updated = [];
    try {
      for (const item of items) {
        const upd = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!upd) {
          // rollback previous
          for (const u of updated) {
            await Product.findByIdAndUpdate(u._id, { $inc: { stock: u.qty } });
          }
          return res.status(400).json({ message: "Stock validation failed during update" });
        }

        updated.push({ _id: upd._id, qty: item.quantity });
      }
    } catch (err) {
      // rollback on unexpected error
      for (const u of updated) {
        await Product.findByIdAndUpdate(u._id, { $inc: { stock: u.qty } });
      }
      throw err;
    }

    // 3) Save order
    const order = new Order(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET all orders (Admin only)
export const getOrders = async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
};

// UPDATE order status (Admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: req.body.orderStatus },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
