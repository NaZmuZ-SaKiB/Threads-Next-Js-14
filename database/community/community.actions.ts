"use server";

import { FilterQuery, SortOrder, Types, startSession } from "mongoose";

import Community from "./community.model";
import Thread, { Like } from "../thread/thread.model";
import User from "../user/user.model";

import { connectToDB } from "@/database/mongoose";

export const createCommunity = async (
  id: string,
  name: string,
  username: string,
  image: string,
  bio: string,
  createdById: string // Change the parameter name to reflect it's an id
) => {
  try {
    connectToDB();

    // Find the user with the provided unique id
    const user = await User.findOne({ id: createdById });

    if (!user) {
      throw new Error("User not found"); // Handle the case if the user with the id is not found
    }

    const newCommunity = new Community({
      id,
      name,
      username,
      image,
      bio,
      createdBy: user._id, // Use the mongoose ID of the user
    });

    const createdCommunity = await newCommunity.save();

    // Update User model
    if (user.communities) {
      user.communities.push(createdCommunity._id);
    } else {
      user.communities = [createdCommunity._id];
    }
    await user.save();

    return createdCommunity;
  } catch (error) {
    // Handle any errors
    console.error("Error creating community:", error);
    throw new Error("Failed to create community");
  }
};

export const getUsersCommunities = async (userId: string) => {
  try {
    connectToDB();

    const communities = await Community.find({
      $or: [
        {
          createdBy: userId,
        },
        {
          members: { $in: [userId] },
        },
      ],
    }).select("_id name image");

    return communities;
  } catch (error) {
    throw new Error("Failed to fetch user communities");
  }
};

export const fetchCommunityDetails = async (id: string) => {
  try {
    connectToDB();

    const communityDetails = await Community.findById(id).populate([
      "createdBy",
      {
        path: "members",
        model: User,
        select: "name username image _id",
      },
    ]);

    return communityDetails;
  } catch (error) {
    // Handle any errors
    console.error("Error fetching community details:", error);
    throw error;
  }
};

export const fetchCommunityThreads = async (
  communityId: string,
  pageNumber: number,
  pageSize: number
) => {
  connectToDB();

  const skip = (pageNumber - 1) * pageSize;
  try {
    const totalthreadsCount = await Thread.countDocuments({
      community: communityId,
    });

    const threads = await Thread.aggregate([
      {
        $match: {
          community: new Types.ObjectId(communityId),
        },
      },
      // Lookup for replies
      {
        $lookup: {
          from: "threads",
          let: { threadId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$parentThread", "$$threadId"],
                },
              },
            },
            // Lookup for replies author
            {
              $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author",
                pipeline: [
                  {
                    $project: {
                      _id: { $toString: "$_id" },
                      name: 1,
                      image: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: "$author",
            },
            {
              $project: {
                _id: { $toString: "$_id" },
                author: 1,
              },
            },
          ],
          as: "replies",
        },
      },
      // Lookup for likes
      {
        $lookup: {
          from: "likes",
          let: { threadId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$threadId", "$$threadId"],
                },
              },
            },
          ],
          as: "likes",
        },
      },
      // Lookup for author
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
          pipeline: [
            {
              $project: {
                _id: { $toString: "$_id" },
                name: 1,
                image: 1,
              },
            },
          ],
        },
      },
      // Unwind author
      {
        $unwind: "$author",
      },
      // Lookup for community
      {
        $lookup: {
          from: "communities",
          localField: "community",
          foreignField: "_id",
          as: "community",
          pipeline: [
            {
              $project: {
                _id: { $toString: "$_id" },
                name: 1,
                image: 1,
              },
            },
          ],
        },
      },
      // Unwind community
      {
        $unwind: {
          path: "$community",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Pagination
      {
        $sort: { createdAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: pageSize,
      },

      // Projecting the final result
      {
        $project: {
          _id: { $toString: "$_id" },
          text: 1,
          likes: {
            $map: {
              input: "$likes",
              as: "like",
              in: { $toString: "$$like.likedBy" }, // Convert ObjectId to string
            },
          },
          replies: 1,
          author: 1,
          community: {
            $ifNull: ["$community", null],
          },
          createdAt: 1,
        },
      },
    ]);

    const isNext = totalthreadsCount > skip + threads.length;
    // console.log("total", totalthreadsCount);
    // console.log("skip", skip);
    // console.log("isnext", isNext);
    // console.log(threads);

    return { threads: threads, isNext };
  } catch (error) {
    // Handle any errors
    console.error("Error fetching community posts:", error);
    throw error;
  }
};

export const getCommunityThreadsCount = async (communityId: string) => {
  connectToDB();

  try {
    const threadsCount = await Thread.countDocuments({
      community: communityId,
      parentThread: { $in: [undefined, null] },
    });

    return threadsCount;
  } catch (error: any) {
    throw new Error(`Failed to fetch user threads count: ${error?.message}`);
  }
};

export const searchCommunities = async ({
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: {
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}) => {
  try {
    connectToDB();

    // Calculate the number of communities to skip based on the page number and page size.
    const skipAmount = (pageNumber - 1) * pageSize;

    // Create a case-insensitive regular expression for the provided search string.
    const regex = new RegExp(searchString, "i");

    // Create an initial query object to filter communities.
    const query: FilterQuery<typeof Community> = {};

    // If the search string is not empty, add the $or operator to match either username or name fields.
    if (searchString.trim() !== "") {
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    // Define the sort options for the fetched communities based on createdAt field and provided sort order.
    const sortOptions = { createdAt: sortBy };

    // Create a query to fetch the communities based on the search and sort criteria.
    const communitiesQuery = Community.find(query)
      .sort(sortOptions)
      .skip(skipAmount)
      .limit(pageSize)
      .populate("members");

    // Count the total number of communities that match the search criteria (without pagination).
    const totalCommunitiesCount = await Community.countDocuments(query);

    const communities = await communitiesQuery.exec();

    // Check if there are more communities beyond the current page.
    const isNext = totalCommunitiesCount > skipAmount + communities.length;

    return { communities, isNext };
  } catch (error) {
    console.error("Error fetching communities:", error);
    throw error;
  }
};

export const addMemberToCommunity = async (
  communityId: string,
  memberId: string
) => {
  try {
    connectToDB();

    // Find the community by its unique id
    const community = await Community.findOne({ id: communityId });

    if (!community) {
      throw new Error("Community not found");
    }

    // Find the user by their unique id
    const user = await User.findOne({ id: memberId });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if the user is already a member of the community
    if (community?.members?.includes(user._id)) {
      throw new Error("User is already a member of the community");
    }

    // Add the user's _id to the members array in the community
    if (community.members) {
      community.members.push(user._id);
    } else {
      community.members = [user._id];
    }
    await community.save();

    // Add the community's _id to the communities array in the user
    if (user.communities) {
      user.communities.push(community._id);
    } else {
      user.communities = [community._id];
    }
    await user.save();

    return community;
  } catch (error) {
    // Handle any errors
    console.error("Error adding member to community:", error);
    throw error;
  }
};

export const removeUserFromCommunity = async (
  userId: string,
  communityId: string
) => {
  try {
    connectToDB();

    const userIdObject = await User.findOne({ id: userId }, { _id: 1 });
    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    if (!userIdObject) {
      throw new Error("User not found");
    }

    if (!communityIdObject) {
      throw new Error("Community not found");
    }

    // Remove the user's _id from the members array in the community
    await Community.updateOne(
      { _id: communityIdObject._id },
      { $pull: { members: userIdObject._id } }
    );

    // Remove the community's _id from the communities array in the user
    await User.updateOne(
      { _id: userIdObject._id },
      { $pull: { communities: communityIdObject._id } }
    );

    return { success: true };
  } catch (error) {
    // Handle any errors
    console.error("Error removing user from community:", error);
    throw error;
  }
};

export const updateCommunityInfo = async (
  communityId: string,
  name: string,
  username: string,
  image: string
) => {
  try {
    connectToDB();

    // Find the community by its _id and update the information
    const updatedCommunity = await Community.findOneAndUpdate(
      { id: communityId },
      { name, username, image }
    );

    if (!updatedCommunity) {
      throw new Error("Community not found");
    }

    return updatedCommunity;
  } catch (error) {
    // Handle any errors
    console.error("Error updating community information:", error);
    throw error;
  }
};

export const deleteCommunity = async (communityId: string) => {
  connectToDB();

  const session = await startSession();
  try {
    session.startTransaction();
    // Find the community by its ID and delete it
    const deletedCommunity = await Community.findOneAndDelete(
      {
        id: communityId,
      },
      { session }
    );

    if (!deletedCommunity) {
      throw new Error("Community not found");
    }

    // Delete all threads associated with the community
    await Thread.deleteMany({ community: communityId }, { session });

    // Find all users who are part of the community
    const communityUsers = await User.find({ communities: communityId }).select(
      "_id"
    );

    // Remove the community from the 'communities' array for each user
    const updateUserPromises = communityUsers.map((user) => {
      User.findByIdAndUpdate(
        user._id,
        {
          $pull: { communities: communityId },
        },
        { session }
      );
    });

    await Promise.all(updateUserPromises);

    await session.commitTransaction();
    await session.endSession();

    return deletedCommunity;
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    console.error("Error deleting community: ", error);
    throw error;
  }
};
