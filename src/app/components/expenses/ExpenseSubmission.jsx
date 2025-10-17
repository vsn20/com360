// src/app/components/expenses/ExpenseSubmission.jsx
"use client";

import React, { useState, useEffect } from "react";
import {
  fetchExpensesByEmpId,
  addExpense,
  updateExpense,
  deleteExpense,
  canEditExpense,
  getExpenseCategories,
} from "@/app/serverActions/expenses/expenses";
import styles from "./ExpenseSubmission.module.css";
import { useRouter } from "next/navigation";

const ExpenseSubmission = ({ empid, orgid, error: initialError }) => {
  const [expenses, setExpenses] = useState([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [expenseData, setExpenseData] = useState({
    start_date: "",
    end_date: "",
    type: "",
    subtype: "",
    category: "",
    description: "",
    amount: "",
    tax: "",
    tip: "",
    total: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [categories, setCategories] = useState({
    types: [],
    subtypes: [],
    categories: [],
  });

  const router = useRouter();

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, [orgid, empid]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    calculateTotal();
  }, [expenseData.amount, expenseData.tax, expenseData.tip]);

  const loadCategories = async () => {
    try {
      const cats = await getExpenseCategories(orgid);
      console.log("📋 Loaded categories:", cats);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const loadExpenses = async () => {
    try {
      const fetchedExpenses = await fetchExpensesByEmpId(empid, orgid);
      console.log("💰 Loaded expenses:", fetchedExpenses);
      setExpenses(fetchedExpenses);
    } catch (err) {
      setError("Failed to load expenses.");
      console.error(err);
    }
  };

  const calculateTotal = () => {
    const amount = parseFloat(expenseData.amount) || 0;
    const tax = parseFloat(expenseData.tax) || 0;
    const tip = parseFloat(expenseData.tip) || 0;
    const total = (amount + tax + tip).toFixed(2);

    setExpenseData((prev) => ({ ...prev, total }));
  };

  // Replace BOTH date functions in ExpenseSubmission.jsx with these:

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "-";

    let dateOnly;

    // Handle different input types
    if (dateString instanceof Date) {
      // If it's a Date object, convert to YYYY-MM-DD
      const year = dateString.getFullYear();
      const month = String(dateString.getMonth() + 1).padStart(2, "0");
      const day = String(dateString.getDate()).padStart(2, "0");
      dateOnly = `${year}-${month}-${day}`;
    } else if (typeof dateString === "string") {
      // If it's a string, extract date part
      dateOnly = dateString.split("T")[0];
    } else {
      return "-";
    }

    // Split into year, month, day
    const [year, month, day] = dateOnly.split("-");

    // Validate
    if (!year || !month || !day) return "-";

    // Create date object without timezone issues
    const date = new Date(year, month - 1, day);

    // Check if date is valid
    if (isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return "";

    let dateOnly;

    // Handle different input types
    if (dateString instanceof Date) {
      // If it's a Date object, convert to YYYY-MM-DD
      const year = dateString.getFullYear();
      const month = String(dateString.getMonth() + 1).padStart(2, "0");
      const day = String(dateString.getDate()).padStart(2, "0");
      dateOnly = `${year}-${month}-${day}`;
    } else if (typeof dateString === "string") {
      // If it's a string, extract date part
      dateOnly = dateString.split("T")[0];
    } else {
      return "";
    }

    // Return as-is for input field (YYYY-MM-DD format)
    return dateOnly;
  };
  const handleRowClick = async (expenseId) => {
    try {
      const expense = expenses.find((e) => e.ID === expenseId);

      const editCheck = await canEditExpense(expenseId);
      if (!editCheck.canEdit) {
        setError(editCheck.reason);
        return;
      }

      setSelectedExpenseId(expenseId);
      setIsAdding(false);
      setIsEditing(false);
      setError(null);
      setSuccessMessage("");

      if (expense) {
        setExpenseData({
          start_date: formatDateForInput(expense.START_DATE),
          end_date: formatDateForInput(expense.END_DATE),
          type: expense.TYPE ? String(expense.TYPE) : "",
          subtype: expense.SUBTYPE ? String(expense.SUBTYPE) : "",
          category: expense.CATEGORY ? String(expense.CATEGORY) : "",
          description: expense.DESCRIPTION || "",
          amount: expense.AMOUNT || "",
          tax: expense.TAX || "",
          tip: expense.TIP || "",
          total: expense.TOTAL || "",
        });

        setExistingAttachments(expense.ATTACHMENTS || []);
        setAttachments([]);
      }
    } catch (err) {
      setError("Failed to load expense details: " + err.message);
      console.error(err);
    }
  };

  const handleAddExpense = () => {
    setIsAdding(true);
    setIsEditing(false);
    setSelectedExpenseId(null);
    setError(null);
    setSuccessMessage("");
    setExistingAttachments([]);
    setAttachments([]);

    setExpenseData({
      start_date: "",
      end_date: "",
      type: "",
      subtype: "",
      category: "",
      description: "",
      amount: "",
      tax: "",
      tip: "",
      total: "",
    });
  };

  const handleEditExpense = () => {
    setIsEditing(true);
    setError(null);
    setSuccessMessage("");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({ ...prev, [name]: value }));
  };

  // Replace the handleFileChange function in ExpenseSubmission.jsx

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    // Validate individual file size (max 5MB per file)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(
          `File "${file.name}" is too large. Maximum size is 5MB per file.`
        );
        e.target.value = ""; // Clear the input
        return;
      }
    }

    // Calculate total size of all files (new + existing)
    const newFilesSize = files.reduce((total, file) => total + file.size, 0);
    const existingFilesSize = attachments.reduce(
      (total, file) => total + file.size,
      0
    );
    const totalSize = newFilesSize + existingFilesSize;

    const maxTotalSize = 5 * 1024 * 1024; // 5MB total limit

    if (totalSize > maxTotalSize) {
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      setError(
        `Total file size (${totalSizeMB} MB) exceeds the 5MB limit. Please remove some files.`
      );
      e.target.value = ""; // Clear the input
      return;
    }

    setAttachments((prev) => [...prev, ...files]);
    setError(null); // Clear any previous errors
  };
  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentId) => {
    setExistingAttachments((prev) =>
      prev.filter((a) => a.ATTACHMENT_ID !== attachmentId)
    );
  };

  const validateForm = () => {
    const requiredFields = [
      "start_date",
      "end_date",
      "type",
      "category",
      "amount",
    ];

    for (const field of requiredFields) {
      if (!expenseData[field] || expenseData[field].toString().trim() === "") {
        const fieldName = field.replace(/_/g, " ");
        throw new Error(`${fieldName} is required`);
      }
    }

    const startDate = new Date(expenseData.start_date);
    const endDate = new Date(expenseData.end_date);

    if (endDate < startDate) {
      throw new Error("End date cannot be before start date");
    }

    const amount = parseFloat(expenseData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    return true;
  };

  const handleSave = async () => {
    setError(null);
    setSuccessMessage("");
    setIsSaving(true);

    try {
      validateForm();

      const formData = new FormData();

      // Add expense data - store IDs not names
      Object.keys(expenseData).forEach((key) => {
        formData.append(key, expenseData[key]);
      });

      formData.append("orgid", orgid);
      formData.append("emp_id", empid);

      // Add new attachments
      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });
      formData.append("attachment_count", attachments.length);

      if (isAdding) {
        console.log("Creating new expense...");
        const result = await addExpense(formData);

        if (result.success) {
          setSuccessMessage("Expense submitted successfully!");
        }
      } else if (isEditing) {
        console.log("Updating expense:", selectedExpenseId);

        // Send list of existing attachments to keep
        formData.append(
          "existing_attachments",
          JSON.stringify(existingAttachments)
        );

        const result = await updateExpense(selectedExpenseId, formData);

        if (result.success) {
          setSuccessMessage("Expense updated successfully!");
        }
      }

      await loadExpenses();

      setTimeout(() => {
        setIsAdding(false);
        setIsEditing(false);
        setSelectedExpenseId(null);
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to save expense");
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (expenseId, e) => {
    e.stopPropagation();

    if (
      !confirm(
        "Are you sure you want to delete this expense? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteExpense(expenseId);
      setSuccessMessage("Expense deleted successfully");
      await loadExpenses();
    } catch (err) {
      setError("Failed to delete expense: " + err.message);
    }
  };

  const canEdit = (expense) => {
    return expense.APPROVED_FLAG !== 1;
  };

  const getStatus = (expense) => {
    if (expense.APPROVED_FLAG === 1) {
      return "Verified";
    }
    return expense.SUBMITTED_DATE ? "Pending" : "Draft";
  };

  const getStatusColor = (expense) => {
    if (expense.APPROVED_FLAG === 1) return "#28a745";
    if (expense.SUBMITTED_DATE) return "#007bff";
    return "#6c757d";
  };

  const getCategoryName = (categoryId, type) => {
    if (!categoryId) return "-";

    const list =
      type === "type"
        ? categories.types
        : type === "subtype"
        ? categories.subtypes
        : categories.categories;

    const item = list.find((c) => c.id === parseInt(categoryId));
    return item ? item.Name : categoryId;
  };

  const handleBack = () => {
    setIsAdding(false);
    setIsEditing(false);
    setSelectedExpenseId(null);
    setError(null);
    setSuccessMessage("");
    setAttachments([]);
    setExistingAttachments([]);
  };

  return (
    <div className={styles.expenseContainer}>
      {error && (
        <div className={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {!isAdding && !selectedExpenseId ? (
        <div className={styles.expensesList}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>My Expenses</h2>
            <button
              className={`${styles.button} ${styles.buttonAdd}`}
              onClick={handleAddExpense}
            >
              Add Expense
            </button>
          </div>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Type</th>
                  <th>Subtype</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      No expenses found. Click "Add Expense" to create one.
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr
                      key={expense.ID}
                      onClick={() =>
                        canEdit(expense) && handleRowClick(expense.ID)
                      }
                      style={{
                        cursor: canEdit(expense) ? "pointer" : "not-allowed",
                        opacity: canEdit(expense) ? 1 : 0.6,
                      }}
                    >
                      <td>{formatDateForDisplay(expense.START_DATE)}</td>
                      <td>{formatDateForDisplay(expense.END_DATE)}</td>
                      <td>{getCategoryName(expense.TYPE, "type")}</td>
                      <td>{getCategoryName(expense.SUBTYPE, "subtype")}</td>
                      <td>{getCategoryName(expense.CATEGORY, "category")}</td>
                      <td>${parseFloat(expense.TOTAL || 0).toFixed(2)}</td>
                      <td>
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: "12px",
                            backgroundColor: getStatusColor(expense) + "20",
                            color: getStatusColor(expense),
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          {getStatus(expense)}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canEdit(expense) && getStatus(expense) === "Draft" && (
                          <button
                            className={`${styles.button} ${styles.buttonCancel}`}
                            onClick={(e) => handleDelete(expense.ID, e)}
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.expenseDetails}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>
              {isAdding ? "Add New Expense" : "View/Edit Expense"}
            </h2>
            <div style={{ display: "flex", gap: "10px" }}>
              {!isEditing && !isAdding && (
                <button
                  className={`${styles.button} ${styles.buttonSave}`}
                  onClick={handleEditExpense}
                >
                  Edit Expense
                </button>
              )}
              <button
                className={`${styles.button} ${styles.buttonBack}`}
                onClick={handleBack}
              >
                Back to List
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className={styles.formSection}>
              <h3>Expense Information</h3>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Start Date*</label>
                  <input
                    type="date"
                    name="start_date"
                    value={expenseData.start_date}
                    onChange={handleFormChange}
                    required
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>End Date*</label>
                  <input
                    type="date"
                    name="end_date"
                    value={expenseData.end_date}
                    onChange={handleFormChange}
                    required
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Type*</label>
                  <select
                    name="type"
                    value={expenseData.type}
                    onChange={handleFormChange}
                    required
                    disabled={!isAdding && !isEditing}
                  >
                    <option value="">Select Type</option>
                    {categories.types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Subtype</label>
                  <select
                    name="subtype"
                    value={expenseData.subtype}
                    onChange={handleFormChange}
                    disabled={!isAdding && !isEditing}
                  >
                    <option value="">Select Subtype</option>
                    {categories.subtypes.map((subtype) => (
                      <option key={subtype.id} value={subtype.id}>
                        {subtype.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Category*</label>
                  <select
                    name="category"
                    value={expenseData.category}
                    onChange={handleFormChange}
                    required
                    disabled={!isAdding && !isEditing}
                  >
                    <option value="">Select Category</option>
                    {categories.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div
                  className={styles.formGroup}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={expenseData.description}
                    onChange={handleFormChange}
                    rows="3"
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Amount*</label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={expenseData.amount}
                    onChange={handleFormChange}
                    required
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    name="tax"
                    value={expenseData.tax}
                    onChange={handleFormChange}
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tip</label>
                  <input
                    type="number"
                    step="0.01"
                    name="tip"
                    value={expenseData.tip}
                    onChange={handleFormChange}
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Total</label>
                  <input
                    type="text"
                    name="total"
                    value={expenseData.total}
                    readOnly
                    disabled
                    style={{ backgroundColor: "#e9ecef", fontWeight: "bold" }}
                  />
                </div>
              </div>

              {isAdding || isEditing ? (
                <div className={styles.formGroup}>
                  <label>Attachments</label>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      marginBottom: "10px",
                    }}
                  >
                    Upload receipts, invoices, or other supporting documents
                    (Max 5MB per file, 5MB total for all files)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    style={{ marginBottom: "10px" }}
                  />
                  {attachments.length > 0 && (
                    <div style={{ marginTop: "10px" }}>
                      <strong>New Attachments:</strong>
                      <ul style={{ marginTop: "5px" }}>
                        {attachments.map((file, index) => (
                          <li
                            key={index}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "5px 0",
                            }}
                          >
                            <span>
                              {file.name} ({(file.size / 1024).toFixed(2)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className={styles.buttonCancel}
                              style={{ padding: "2px 8px", fontSize: "12px" }}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {existingAttachments.length > 0 && (
                    <div style={{ marginTop: "15px" }}>
                      <strong>Existing Attachments:</strong>
                      <ul style={{ marginTop: "5px" }}>
                        {existingAttachments.map((attachment) => (
                          <li
                            key={attachment.ATTACHMENT_ID}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "5px 0",
                            }}
                          >
                            <a
                              href={attachment.ATTACHMENT_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#007bff",
                                textDecoration: "none",
                              }}
                            >
                              View {attachment.ATTACHMENT_TYPE}
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                removeExistingAttachment(
                                  attachment.ATTACHMENT_ID
                                )
                              }
                              className={styles.buttonCancel}
                              style={{ padding: "2px 8px", fontSize: "12px" }}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                existingAttachments.length > 0 && (
                  <div className={styles.formGroup}>
                    <label>Attachments</label>
                    <ul style={{ marginTop: "5px" }}>
                      {existingAttachments.map((attachment) => (
                        <li
                          key={attachment.ATTACHMENT_ID}
                          style={{ padding: "5px 0" }}
                        >
                          <a
                            href={attachment.ATTACHMENT_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#007bff", textDecoration: "none" }}
                          >
                            View {attachment.ATTACHMENT_TYPE}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}

              {!isAdding && !isEditing && (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Submitted Date</label>
                      <input
                        type="text"
                        value={
                          expenses.find((e) => e.ID === selectedExpenseId)
                            ?.SUBMITTED_DATE
                            ? new Date(
                                expenses.find(
                                  (e) => e.ID === selectedExpenseId
                                ).SUBMITTED_DATE
                              ).toLocaleString()
                            : "Not submitted"
                        }
                        readOnly
                        disabled
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Verified By</label>
                      <input
                        type="text"
                        value={
                          expenses.find((e) => e.ID === selectedExpenseId)
                            ?.VERIFIER_NAME || "Not verified"
                        }
                        readOnly
                        disabled
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {(isAdding || isEditing) && (
              <div className={styles.formButtons}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonSave}`}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Submit Expense"}
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonCancel}`}
                  onClick={handleBack}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default ExpenseSubmission;
