const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    orderedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "orderedByModel"
    },

    orderedByModel: {
        type: String,
        required: true,
        enum: ["Student", "Teacher"]
    },

    orderedByName: {
        type: String,
        required: true
    },

    items: [
        {
            menuItemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "MenuItem"
            },
            name: String,
            price: Number,
            qty: Number
        }
    ],

    itemsTotal: {
        type: Number,
        required: true
    },

    deliveryFee: {
        type: Number,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: true
    },

    orderType: {
        type: String,
        enum: ["delivery", "pickup"],
        required: true
    },

    deliveryDetails: {
        department: String,
        semester: String,
        section: String
    },

  status: {
    type: String,
    enum: ["placed", "accepted", "preparing", "ready", "completed", "cancelled"],
    default: "placed"
},

    paymentStatus: {
        type: String,
        enum: ["pending", "paid"],
        default: "pending"
    },

    paymentId: {
        type: String,
        default: ""
    }

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);