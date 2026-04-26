import JobType from "@/types/job";
import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    bidPlaced: {
      type: Boolean,
      default: false,
    },
    refCategory: { type: String, required: false },
    refDescription: { type: String, required: false },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<Document & JobType>("Job", JobSchema);
