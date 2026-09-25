import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // Customer who placed the order
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Shipping Information
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },

    // Ordered Products
    items: {
      type: [
        {
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },

          name: {
            type: String,
            required: true,
          },

          image: {
            type: String,
            default: "",
          },

          price: {
            type: Number,
            required: true,
            min: 0,
          },

          quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
          },
          metadata: {
            paidQuantity: { type: Number },
            freeQuantity: { type: Number },
            offerType: { type: String },
          }
        }
      ],
      required: [true, "At least one item is required"],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Order must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shippingCharge: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: {
        values: ["COD", "ONLINE"],
        message: "Payment method must be COD or ONLINE",
      },
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: {
        values: ["Pending", "Paid", "Failed", "Refunded"],
        message: "{VALUE} is not a valid payment status",
      },
      default: "Pending",
    },

    orderStatus: {
      type: String,
      enum: {
        values: [
          "Pending",
          "Confirmed",
          "Packed",
          "Shipped",
          "Out for Delivery",
          "Delivered",
          "Cancelled",
        ],
        message: "{VALUE} is not a valid order status",
      },
      default: "Pending",
    },

    paidAt: Date,

    deliveredAt: Date,
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
