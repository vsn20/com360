'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import './reviews.css';
import { createReview, updateReview, deleteReview } from '@/app/serverActions/Performance_Review/reviews';

// Helper to get years for dropdowns
const getYearOptions = (range = 5) => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + range; y >= currentYear - range; y--) {
    years.push(y.toString());
  }
  return years;
};

// Default state for the review form
const DEFAULT_FORM_DATA = {
  id: null,
  employee_id: '',
  review_year: new Date().getFullYear().toString(),
  review_date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
  rating: '3',
  review_text: '',
  comments: '',
};

const Reviews = ({
  initialReviews,
  reviewEmployees,
  permissionLevel,
  loggedInEmpId,
  orgid
}) => {
  const router = useRouter();

  // --- Filter initialReviews based on permission ---
  const visibleReviews = useMemo(() => {
    if (permissionLevel === 'team') {
      // For team leads, filter out their own reviews from the table
      return (initialReviews || []).filter(
        (review) => String(review.employee_id) !== String(loggedInEmpId)
      );
    }
    // For 'all' permission, show everything
    return initialReviews || [];
  }, [initialReviews, permissionLevel, loggedInEmpId]);

  // --- STATE ---
  const [reviews, setReviews] = useState(visibleReviews);
  
  // Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [reviewsPerPage, setReviewsPerPage] = useState(10);
  const [reviewsPerPageInput, setReviewsPerPageInput] = useState('10');
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update state if the filtered server data changes
  useEffect(() => {
    setReviews(visibleReviews);
  }, [visibleReviews]);

  // --- DERIVED DATA & FILTERS ---

  // Get a unique, sorted list of years from the reviews
  const availableYears = useMemo(() => {
    const years = new Set(reviews.map(r => r.review_year.toString()));
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [reviews]);

  // Filter the reviews based on state
  const filteredReviews = useMemo(() => {
    return reviews.filter(review => {
      const matchEmp = filterEmployeeId === 'all' || String(review.employee_id) === filterEmployeeId;
      const matchYear = filterYear === 'all' || String(review.review_year) === filterYear;
      return matchEmp && matchYear;
    });
  }, [reviews, filterEmployeeId, filterYear]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredReviews.length / reviewsPerPage);
  const indexOfLastReview = currentPage * reviewsPerPage;
  const indexOfFirstReview = indexOfLastReview - reviewsPerPage;
  const currentReviews = filteredReviews.slice(indexOfFirstReview, indexOfLastReview);

  // Reset to page 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
    setPageInputValue('1');
  }, [filterEmployeeId, filterYear, reviewsPerPage]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setReviewsPerPageInput(reviewsPerPage.toString());
  }, [reviewsPerPage]);

  // --- EVENT HANDLERS ---

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReview(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(false);
  };

  const handleAddClick = () => {
    setFormData(DEFAULT_FORM_DATA);
    setEditingReview(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (review) => {
    setFormData({
      id: review.id,
      employee_id: review.employee_id,
      review_year: review.review_year,
      review_date: review.review_date,
      rating: review.rating,
      review_text: review.review_text,
      comments: review.comments || '',
    });
    setEditingReview(review);
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const formDataObject = new FormData();
    for (const key in formData) {
      if (formData[key] !== null) {
        formDataObject.append(key, formData[key]);
      }
    }

    try {
      if (editingReview) {
        const result = await updateReview(formDataObject);
        if (result.error) throw new Error(result.error);
        setFormSuccess('Review updated successfully!');
      } else {
        const result = await createReview(formDataObject);
        if (result.error) throw new Error(result.error);
        setFormSuccess('Review added successfully!');
      }
      
      setTimeout(() => {
        closeModal();
        router.refresh();
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (e, review) => {
    e.stopPropagation();
    
    const userConfirmed = window.prompt("To delete this review, type DELETE and click OK.", "");
    if (userConfirmed !== "DELETE") return;

    try {
      const result = await deleteReview(review.id);
      if (result.error) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      alert(`Error deleting review: ${err.message}`);
    }
  };

  // --- PAGINATION HANDLERS ---
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };
  
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  
  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) setCurrentPage(value);
      else setPageInputValue(currentPage.toString());
    }
  };
  
  const handleReviewsPerPageInputChange = (e) => setReviewsPerPageInput(e.target.value);
  
  const handleReviewsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) setReviewsPerPage(value);
      else setReviewsPerPageInput(reviewsPerPage.toString());
    }
  };

  return (
    <div className="Employee_Reviews_container">
      {/* --- HEADER: Title and Add Button --- */}
      <div className="Employee_Reviews_header-section">
        <h2 className="Employee_Reviews_title">Performance Reviews</h2>
        <button className="Employee_Reviews_save Employee_Reviews_button" onClick={handleAddClick}>
          Add Review
        </button>
      </div>

      {/* --- FILTERS: Employee and Year (UPDATED to match Goals) --- */}
      <div className="Employee_Reviews_search-filter-container">
        <select
          className="Employee_Reviews_filter-select"
          value={filterEmployeeId}
          onChange={(e) => setFilterEmployeeId(e.target.value)}
        >
          <option value="all">All Visible Employees</option>
          {reviewEmployees.map(emp => (
            <option key={emp.empid} value={emp.empid}>{emp.name}</option>
          ))}
        </select>

        <select
          className="Employee_Reviews_filter-select"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          <option value="all">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      
      {/* --- REVIEWS TABLE --- */}
      <div className="Employee_Reviews_table-wrapper">
        <table className="Employee_Reviews_table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Year</th>
              <th>Date</th>
              <th>Rating</th>
              <th>Review Text</th>
              <th>Comments</th>
              <th>Supervisor</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentReviews.length > 0 ? (
              currentReviews.map(review => (
                <tr key={review.id} onClick={() => handleEditClick(review)}>
                  <td>{review.employee_name}</td>
                  <td>{review.review_year}</td>
                  <td>{review.review_date}</td>
                  <td>{review.rating}</td>
                  <td>{review.review_text}</td>
                  <td>{review.comments || '-'}</td>
                  <td>{review.supervisor_name}</td>
                  <td>
                    <button
                      className="Employee_Reviews_cancel Employee_Reviews_button"
                      onClick={(e) => handleDeleteClick(e, review)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="Employee_Reviews_empty-state">
                  No reviews found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- PAGINATION CONTROLS --- */}
      {filteredReviews.length > reviewsPerPage && (
        <div className="Employee_Reviews_pagination-container">
          <button
            className="Employee_Reviews_button Employee_Reviews_cancel"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            style={{ minWidth: '100px' }}
          >
            ← Previous
          </button>
          <span className="Employee_Reviews_pagination-text">
            Page{' '}
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyPress={handlePageInputKeyPress}
              className="Employee_Reviews_pagination-input"
            />{' '}
            of {totalPages}
          </span>
          <button
            className="Employee_Reviews_button Employee_Reviews_save"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{ minWidth: '100px' }}
          >
            Next →
          </button>
        </div>
      )}
      
      <div className="Employee_Reviews_rows-per-page-container">
        <label className="Employee_Reviews_rows-per-page-label">Rows per Page:</label>
        <input
          type="text"
          value={reviewsPerPageInput}
          onChange={handleReviewsPerPageInputChange}
          onKeyPress={handleReviewsPerPageInputKeyPress}
          className="Employee_Reviews_rows-per-page-input"
        />
      </div>

      {/* --- ADD/EDIT MODAL --- */}
      {isModalOpen && (
        <div className="Employee_Reviews_modal-overlay" onClick={closeModal}>
          <div className="Employee_Reviews_modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="Employee_Reviews_modal-header">
              <h3 className="Employee_Reviews_modal-title">
                {editingReview ? 'Edit Review' : 'Add New Review'}
              </h3>
              <button className="Employee_Reviews_modal-close-button" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form className="Employee_Reviews_form" onSubmit={handleSubmit}>
              {formError && <div className="Employee_Reviews_error-message">{formError}</div>}
              {formSuccess && <div className="Employee_Reviews_success-message">{formSuccess}</div>}

              {/* --- Employee Selection --- */}
              <div className="Employee_Reviews_form-group">
                <label htmlFor="employee_id">Employee</label>
                <select
                  id="employee_id"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleFormChange}
                  disabled={!!editingReview}
                  required
                >
                  <option value="" disabled>Select an employee</option>
                  {reviewEmployees.map(emp => (
                    <option key={emp.empid} value={emp.empid}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {/* --- Year --- */}
              <div className="Employee_Reviews_form-group">
                <label htmlFor="review_year">Review Year</label>
                <select
                  id="review_year"
                  name="review_year"
                  value={formData.review_year}
                  onChange={handleFormChange}
                  required
                >
                  {getYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* --- Date and Rating --- */}
              <div className="Employee_Reviews_form-row">
                <div className="Employee_Reviews_form-group">
                  <label htmlFor="review_date">Review Date</label>
                  <input
                    type="date"
                    id="review_date"
                    name="review_date"
                    value={formData.review_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="Employee_Reviews_form-group">
                  <label htmlFor="rating">Rating (1-5)</label>
                  <select
                    id="rating"
                    name="rating"
                    value={formData.rating}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="1">1 - Poor</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="3">3 - Meets Expectations</option>
                    <option value="4">4 - Exceeds Expectations</option>
                    <option value="5">5 - Outstanding</option>
                  </select>
                </div>
              </div>

              {/* --- Review Text --- */}
              <div className="Employee_Reviews_form-group">
                <label htmlFor="review_text">Review Text</label>
                <textarea
                  id="review_text"
                  name="review_text"
                  value={formData.review_text}
                  onChange={handleFormChange}
                  rows="4"
                  required
                />
              </div>

              {/* --- Comments --- */}
              <div className="Employee_Reviews_form-group">
                <label htmlFor="comments">Optional Comments</label>
                <textarea
                  id="comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleFormChange}
                  rows="3"
                />
              </div>

              {/* --- Form Actions --- */}
              <div className="Employee_Reviews_form-buttons">
                <button
                  type="button"
                  className="Employee_Reviews_cancel Employee_Reviews_button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="Employee_Reviews_save Employee_Reviews_button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (editingReview ? 'Update Review' : 'Add Review')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;