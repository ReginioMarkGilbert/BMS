import BarangayClearance from "../models/barangay.clearance.model.js";
import BarangayIndigency from "../models/barangay.indigency.model.js";
import BusinessClearance from "../models/business.clearance.model.js";
import Cedula from "../models/cedula.model.js";
import User from "../models/user.model.js";
import {
    sendDocumentRequestNotification,
    sendDocumentStatusNotification
} from "../utils/notifications.js";

// Generic function to update document status
export const updateDocumentStatus = async (Model, requestType, id, status) => {
    // Normalize status to lowercase to match schema enum
    const normalizedStatus = status.toLowerCase();

    const document = await Model.findById(id);
    if (!document) {
        throw new Error(`${requestType} not found`);
    }

    document.isVerified = normalizedStatus === "approved";
    document.status = normalizedStatus;
    document.dateOfIssuance = new Date();

    await document.save();

    // Send status notification to requestor
    await sendDocumentStatusNotification(document, normalizedStatus, requestType);

    return document;
};

// Get all document requests for a barangay
export const getAllDocumentRequests = async (req, res, next) => {
    try {
        // Add authentication verification logging
        console.log("Request headers:", req.headers);
        console.log("Authenticated user:", req.user);

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const { barangay } = req.user;

        if (!barangay) {
            return res.status(400).json({
                success: false,
                message: "User barangay not found"
            });
        }

        console.log("Fetching requests for barangay:", barangay);

        // Fetch requests from all document types
        const [clearances, indigency, business, cedulas] = await Promise.all([
            BarangayClearance.find({ barangay }).sort({ createdAt: -1 }),
            BarangayIndigency.find({ barangay }).sort({ createdAt: -1 }),
            BusinessClearance.find({ barangay }).sort({ createdAt: -1 }),
            Cedula.find({ barangay }).sort({ createdAt: -1 }),
        ]);

        console.log("Found documents:", {
            clearances: clearances.length,
            indigency: indigency.length,
            business: business.length,
            cedulas: cedulas.length,
        });

        // Transform and combine all requests
        const allRequests = [
            ...clearances.map((doc) => ({
                id: doc._id,
                type: "Barangay Clearance",
                requestDate: doc.createdAt || new Date(),
                residentName: doc.name,
                status: doc.status || "Pending",
                purpose: doc.purpose,
                email: doc.email,
                contactNumber: doc.contactNumber,
            })),
            ...indigency.map((doc) => ({
                id: doc._id,
                type: "Certificate of Indigency",
                requestDate: doc.createdAt || new Date(),
                residentName: doc.name,
                status: doc.status || "Pending",
                purpose: doc.purpose,
                contactNumber: doc.contactNumber,
            })),
            ...business.map((doc) => ({
                id: doc._id,
                type: "Business Clearance",
                requestDate: doc.createdAt || new Date(),
                residentName: doc.ownerName,
                status: doc.status || "Pending",
                purpose: "Business Permit",
                businessName: doc.businessName,
                businessType: doc.businessType,
                businessNature: doc.businessNature,
                ownerAddress: doc.ownerAddress,
                contactNumber: doc.contactNumber,
                email: doc.email,
            })),
            ...cedulas.map((doc) => ({
                id: doc._id,
                type: "Cedula",
                requestDate: doc.createdAt || new Date(),
                residentName: doc.name,
                status: doc.status || "Pending",
                purpose: "Community Tax Certificate",
                dateOfBirth: doc.dateOfBirth,
                placeOfBirth: doc.placeOfBirth,
                civilStatus: doc.civilStatus,
                occupation: doc.occupation,
                tax: doc.tax,
            })),
        ];

        // Sort all requests by date
        const sortedRequests = allRequests.sort(
            (a, b) => new Date(b.requestDate) - new Date(a.requestDate)
        );

        console.log("Sending response with", sortedRequests.length, "total requests");

        res.status(200).json({
            success: true,
            data: sortedRequests,
        });
    } catch (error) {
        console.error("Error in getAllDocumentRequests:", error);
        next(error);
    }
};

// Generic function to create document request
const createDocumentRequest = async (Model, requestType, reqBody, userBarangay) => {
    const document = new Model({
        ...reqBody,
        barangay: userBarangay
    });

    await document.save();
    console.log(`Saved ${requestType}:`, document._id);

    // Send notification to secretaries
    await sendDocumentRequestNotification(document, requestType);

    return document;
};

// Create document request handlers
export const createBarangayClearance = async (req, res, next) => {
    try {
        const document = await createDocumentRequest(
            BarangayClearance,
            "Barangay Clearance",
            req.body,
            req.user.barangay
        );

        res.status(201).json({
            success: true,
            message: "Barangay clearance request created successfully",
            data: document
        });
    } catch (error) {
        console.error("Error creating barangay clearance:", error);
        next(error);
    }
};

export const createBarangayIndigency = async (req, res, next) => {
    try {
        const document = await createDocumentRequest(
            BarangayIndigency,
            "Barangay Indigency",
            req.body,
            req.user.barangay
        );

        res.status(201).json({
            success: true,
            message: "Barangay indigency request created successfully",
            data: document
        });
    } catch (error) {
        console.error("Error creating barangay indigency:", error);
        next(error);
    }
};

// Update status handlers
export const updateBarangayClearanceStatus = async (req, res, next) => {
    try {
        const document = await updateDocumentStatus(
            BarangayClearance,
            "Barangay Clearance",
            req.params.id,
            req.body.status
        );

        res.status(200).json({
            success: true,
            data: document
        });
    } catch (error) {
        console.error("Error updating barangay clearance status:", error);
        next(error);
    }
};

export const updateBarangayIndigencyStatus = async (req, res, next) => {
    try {
        const document = await updateDocumentStatus(
            BarangayIndigency,
            "Barangay Indigency",
            req.params.id,
            req.body.status
        );

        res.status(200).json({
            success: true,
            data: document
        });
    } catch (error) {
        console.error("Error updating barangay indigency status:", error);
        next(error);
    }
};

// Add these exports for business clearance and cedula
export const createBusinessClearance = async (req, res, next) => {
    try {
        const document = await createDocumentRequest(
            BusinessClearance,
            "Business Clearance",
            req.body,
            req.user.barangay
        );

        res.status(201).json({
            success: true,
            message: "Business clearance request created successfully",
            data: document
        });
    } catch (error) {
        console.error("Error creating business clearance:", error);
        next(error);
    }
};

export const createCedula = async (req, res, next) => {
    try {
        const document = await createDocumentRequest(
            Cedula,
            "Cedula",
            req.body,
            req.user.barangay
        );

        res.status(201).json({
            success: true,
            message: "Cedula request created successfully",
            data: document
        });
    } catch (error) {
        console.error("Error creating cedula request:", error);
        next(error);
    }
};

export const updateBusinessClearanceStatus = async (req, res, next) => {
    try {
        const document = await updateDocumentStatus(
            BusinessClearance,
            "Business Clearance",
            req.params.id,
            req.body.status
        );

        res.status(200).json({
            success: true,
            data: document
        });
    } catch (error) {
        console.error("Error updating business clearance status:", error);
        next(error);
    }
};

export const updateCedulaStatus = async (req, res, next) => {
    try {
        const document = await updateDocumentStatus(
            Cedula,
            "Cedula",
            req.params.id,
            req.body.status
        );

        res.status(200).json({
            success: true,
            data: document
        });
    } catch (error) {
        console.error("Error updating cedula status:", error);
        next(error);
    }
};
