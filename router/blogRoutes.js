const express = require("express");
const router = express.Router();

const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  getVisibleBlogs
} = require("../controller/blogController");




// Routes
router.post("/create", createBlog);
router.get("/", getAllBlogs);
router.get("/visible", getVisibleBlogs);
router.get("/:id", getBlogById);
router.put("/:id", updateBlog);
router.delete("/:id", deleteBlog);

module.exports = router;
