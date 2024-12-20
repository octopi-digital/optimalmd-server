const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    url: { type: String, required: true },
    image: { type: String, required: true },
    show: { type: Number, default: 1 }, // 1 for visible, 0 for hidden
    publishDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
