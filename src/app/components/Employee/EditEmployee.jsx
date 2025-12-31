'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchEmployeeById, 
  fetchLeaveAssignments, 
  updateEmployee,
  fetchdocumentsbyid ,
  fetchPafDocumentsById,
  fetchFdnsDocumentsById,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadSignature,
  deleteSignature 
} from '@/app/serverActions/Employee/overview';
import { fetchImmigrationData } from '@/app/serverActions/Employee/Immigration'; 
import { 
  fetchExperienceByEmpId, 
  fetchEducationByEmpId 
} from '@/app/serverActions/Employee/experienceEducation';

import './overview.css';
import { useRouter } from 'next/navigation';
import EmplopyeeDocument from './EmplopyeeDocument';
import EmployeeEducation from './EmployeeEducation';
import EmployeeExperience from './EmployeeExperience';
import Image from 'next/image';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import PAFDocument from './PAFDocument';
import FDNS_Document from './FDNS_Document';
import Immigration from './Immigration';

// Import the new sub-components
import PersonalDetails from './PersonalDetails';
import EmploymentDetails from './EmploymentDetails';
import LeaveAssignments from './LeaveAssignments';
import { WorkAddress, HomeAddress, EmergencyContact } from './AddressComponents';

const EditEmployee = ({
  selectedEmpId,
  roles,
  orgid,
  employees: allEmployees, 
  leaveTypes,
  countries,
  states,
  departments,
  payFrequencies,
  jobTitles,
  statuses,
  workerCompClasses,
  suborgs,
  document_types,
  document_purposes,
  document_subtypes,
  employmentTypes,
  immigrationStatuses, 
  immigrationDocTypes,    
  immigrationDocSubtypes,
  paf_document_types,
  paf_document_subtypes,
  paf_document_statuses,
  fdns_document_types,
  fdns_document_subtypes,
  fdns_document_statuses,
  loggedInEmpId,      
  permissionLevel,
  onBack,
  org_name,
  vendors
}) => {
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [leaveAssignments, setLeaveAssignments] = useState({});
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [showVendorField, setShowVendorField] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [selecteddocument,setselecteddocument]=useState(null);
  
  const [imgSrc, setImgSrc] = useState(
    selectedEmpId 
      ? `/uploads/profile_photos/${selectedEmpId}.png?${new Date().getTime()}` 
      : "/uploads/profile_photos/default.png"
  );
  
  const [signatureSrc, setSignatureSrc] = useState(
    selectedEmpId 
      ? `/uploads/signatures/${selectedEmpId}.jpg?${new Date().getTime()}` 
      : null
  );
  const [signatureFile, setSignatureFile] = useState(null);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState();
  const imgRef = useRef(null);
  const [photoModalError, setPhotoModalError] = useState(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    empid: '',
    orgid: orgid || '',
    empFstName: '',
    empMidName: '',
    empLastName: '',
    empPrefName: '',
    email: '',
    roleid: '',
    gender: '',
    mobileNumber: '',
    phoneNumber: '',
    dob: '',
    hireDate: '',
    lastWorkDate: '',
    terminatedDate: '',
    rejoinDate: '',
    superior: '',
    ssn: '',
    status: '',
    linkedinUrl: '',
    jobTitle: '',
    payFrequency: '',
    deptId: '',
    deptName: '',
    workCompClass: '',
    suborgid: '',
    employee_number: '',
    employment_type: '',
    vendor_id: '',
    workAddrLine1: '',
    workAddrLine2: '',
    workAddrLine3: '',
    workCity: '',
    workStateId: '',
    workStateNameCustom: '',
    workCountryId: '185',
    workPostalCode: '',
    homeAddrLine1: '',
    homeAddrLine2: '',
    homeAddrLine3: '',
    homeCity: '',
    homeStateId: '',
    homeStateNameCustom: '',
    homeCountryId: '185',
    homePostalCode: '',
    emergCnctName: '',
    emergCnctPhoneNumber: '',
    emergCnctEmail: '',
    emergCnctAddrLine1: '',
    emergCnctAddrLine2: '',
    emergCnctAddrLine3: '',
    emergCnctCity: '',
    emergCnctStateId: '',
    emergCnctStateNameCustom: '',
    emergCnctCountryId: '185',
    emergCnctPostalCode: '',
  });
  
  const [formLeaves, setFormLeaves] = useState({});
  const [error, setError] = useState(null);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [editingLeaves, setEditingLeaves] = useState(false);
  const [editingWorkAddress, setEditingWorkAddress] = useState(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState(false);
  const [editingEmergencyContact, setEditingEmergencyContact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [savingSection, setSavingSection] = useState(null);
  const [employeedocuments,setemployeedocuments]=useState({});
  
  const [experiencedetails, setexperiencedetails] = useState(null);
  const [educationdetails, seteducationdetails] = useState(null);
  const [pafdocument,setpafdocument]=useState(null);
  const [fdnsdocument,setfdnsdocument]=useState(null);
  const [immigrationdetails, setimmigrationdetails] = useState(null); 
  
  const [pafDocuments, setPafDocuments] = useState([]);
  const [fdnsDocuments, setFdnsDocuments] = useState([]);
  const [immigrationData, setImmigrationData] = useState([]); 
  const [experienceData, setExperienceData] = useState([]); 
  const [educationData, setEducationData] = useState([]); 

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setError(null);
    setselecteddocument(null);
    setActiveTab('personal');
    setpersonaldetails(selectedEmpId);
    setworkdetails(null);
    setemployementdetails(null);
    setexperiencedetails(null);
    seteducationdetails(null);
    setpafdocument(null);
    setfdnsdocument(null);
    setimmigrationdetails(null);
    setImmigrationData([]); 
    setExperienceData([]); 
    setEducationData([]); 
    setShowVendorField(false);
    
    setImgSrc(`/uploads/profile_photos/${selectedEmpId}.png?${new Date().getTime()}`);
    setSignatureSrc(`/uploads/signatures/${selectedEmpId}.jpg?${new Date().getTime()}`);
  }, [selectedEmpId]);

  useEffect(() => {
    const loadEmployeeDetails = async () => {
      if (!selectedEmpId) return;
      
      try {
        const [employee, leaveData, docs, pafDocs, fdnsDocs, immigDocs, expData, eduData] = await Promise.all([
          fetchEmployeeById(selectedEmpId),
          fetchLeaveAssignments(selectedEmpId),
          fetchdocumentsbyid(selectedEmpId),
          fetchPafDocumentsById(selectedEmpId), 
          fetchFdnsDocumentsById(selectedEmpId),
          fetchImmigrationData(selectedEmpId),
          fetchExperienceByEmpId(selectedEmpId),
          fetchEducationByEmpId(selectedEmpId) 
        ]);
        
        if (!employee.orgid) {
          setError('Employee data is missing organization ID.');
          return;
        }
        setEmployeeDetails(employee);
        setLeaveAssignments(leaveData);
        setemployeedocuments(Array.isArray(docs) ? docs : []);
        setPafDocuments(Array.isArray(pafDocs) ? pafDocs : []); 
        setFdnsDocuments(Array.isArray(fdnsDocs) ? fdnsDocs : []); 
        setImmigrationData(Array.isArray(immigDocs) ? immigDocs : []); 
        setExperienceData(Array.isArray(expData) ? expData : []); 
        setEducationData(Array.isArray(eduData) ? eduData : []); 

        setSelectedRoles(employee.roleids || []);
        
        setFormData({
            empid: employee.empid || '',
            orgid: employee.orgid || orgid || '',
            empFstName: employee.EMP_FST_NAME || '',
            empMidName: employee.EMP_MID_NAME || '',
            empLastName: employee.EMP_LAST_NAME || '',
            empPrefName: employee.EMP_PREF_NAME || '',
            email: employee.email || '',
            roleid: employee.roleid || '',
            gender: employee.GENDER || '',
            mobileNumber: employee.MOBILE_NUMBER || '',
            phoneNumber: employee.PHONE_NUMBER || '',
            dob: employee.DOB || '',
            hireDate: employee.HIRE || '',
            lastWorkDate: employee.LAST_WORK_DATE || '',
            terminatedDate: employee.TERMINATED_DATE || '',
            rejoinDate: employee.REJOIN_DATE || '',
            superior: employee.superior || '',
            ssn: employee.SSN || '',
            status: employee.STATUS || '',
            linkedinUrl: employee.LINKEDIN_URL || '',
            jobTitle: employee.JOB_TITLE || '',
            payFrequency: employee.PAY_FREQUENCY || '',
            deptId: employee.DEPT_ID !== null && employee.DEPT_ID !== undefined ? String(employee.DEPT_ID) : '',
            deptName: employee.DEPT_NAME || '',
            workCompClass: employee.WORK_COMP_CLASS || '',
            suborgid: employee.suborgid || '',
            employee_number: employee.employee_number || '',
            employment_type: employee.employment_type || '',
            workAddrLine1: employee.WORK_ADDR_LINE1 || '',
            workAddrLine2: employee.WORK_ADDR_LINE2 || '',
            workAddrLine3: employee.WORK_ADDR_LINE3 || '',
            workCity: employee.WORK_CITY || '',
            workStateId: employee.WORK_STATE_ID ? String(employee.WORK_STATE_ID) : '',
            workStateNameCustom: employee.WORK_STATE_NAME_CUSTOM || '',
            workCountryId: employee.WORK_COUNTRY_ID ? String(employee.WORK_COUNTRY_ID) : '185',
            workPostalCode: employee.WORK_POSTAL_CODE || '',
            homeAddrLine1: employee.HOME_ADDR_LINE1 || '',
            homeAddrLine2: employee.HOME_ADDR_LINE2 || '',
            homeAddrLine3: employee.HOME_ADDR_LINE3 || '',
            homeCity: employee.HOME_CITY || '',
            homeStateId: employee.HOME_STATE_ID ? String(employee.HOME_STATE_ID) : '',
            homeStateNameCustom: employee.HOME_STATE_NAME_CUSTOM || '',
            homeCountryId: employee.HOME_COUNTRY_ID ? String(employee.HOME_COUNTRY_ID) : '185',
            homePostalCode: employee.HOME_POSTAL_CODE || '',
            emergCnctName: employee.EMERG_CNCT_NAME || '',
            emergCnctPhoneNumber: employee.EMERG_CNCT_PHONE_NUMBER || '',
            emergCnctEmail: employee.EMERG_CNCT_EMAIL || '',
            emergCnctAddrLine1: employee.EMERG_CNCT_ADDR_LINE1 || '',
            emergCnctAddrLine2: employee.EMERG_CNCT_ADDR_LINE2 || '',
            emergCnctAddrLine3: employee.EMERG_CNCT_ADDR_LINE3 || '',
            emergCnctCity: employee.EMERG_CNCT_CITY || '',
            emergCnctStateId: employee.EMERG_CNCT_STATE_ID ? String(employee.EMERG_CNCT_STATE_ID) : '',
            emergCnctStateNameCustom: employee.EMERG_CNCT_STATE_NAME_CUSTOM || '',
            emergCnctCountryId: employee.EMERG_CNCT_COUNTRY_ID ? String(employee.EMERG_CNCT_COUNTRY_ID) : '185',
            emergCnctPostalCode: employee.EMERG_CNCT_POSTAL_CODE || '',
            vendor_id: employee.vendor_id ? String(employee.vendor_id) : '',
          });
        
        const empType = employee.employment_type ? String(employee.employment_type) : '';
        setShowVendorField(empType === '12' || empType === '13');
        
        setFormLeaves(leaveData);
        setError(null);
      } catch (err) {
        console.error('Error loading employee details:', err);
        setError(err.message);
      }
    };
    loadEmployeeDetails();
  }, [selectedEmpId, orgid]);

  // ... (CanEdit, DocumentSelecting functions omitted for brevity, same as previous) ...
  const canEdit = (section) => {
    if (!selectedEmpId) return false;
    const restrictedSections = ['employment', 'leaves'];
    if (permissionLevel === 'individual') {
        return !restrictedSections.includes(section) && selectedEmpId === loggedInEmpId;
    }
    if (permissionLevel === 'team') {
        if (selectedEmpId === loggedInEmpId) {
            return !restrictedSections.includes(section);
        } else {
            return true;
        }
    }
    if (permissionLevel === 'all') return true;
    return false;
  };
  
  const documentselecting=(id)=>{
    setselecteddocument(id);
    setpersonaldetails(null);
    setemployementdetails(null);
    setActiveTab('documents');
    setworkdetails(null);
    router.refresh();
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setexperiencedetails(null);
    seteducationdetails(null);
    setpafdocument(null);
    setfdnsdocument(null);
    setimmigrationdetails(null); 
    setError(null);
    router.refresh();
  }
  const [personaldetails,setpersonaldetails]=useState(null);
  const  personaldetailsselecting=(id)=>{
    setselecteddocument(null);
    setpersonaldetails(id);
    setActiveTab('personal');
    setemployementdetails(null);
    setworkdetails(null);
    router.refresh();
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setexperiencedetails(null);
    seteducationdetails(null);
    setpafdocument(null);
    setfdnsdocument(null);
    setimmigrationdetails(null); 
    setError(null);
    router.refresh();
  }
  const [employementdetails,setemployementdetails]=useState(null);
   const employementdetailselecting=(id)=>{
    setselecteddocument(null);
    setpersonaldetails(null);
    setActiveTab('employment');
    setemployementdetails(id);
    setworkdetails(null);
    router.refresh();
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setexperiencedetails(null);
    seteducationdetails(null);
    setpafdocument(null);
    setfdnsdocument(null);
    setimmigrationdetails(null); 
    setError(null);
    router.refresh();
   }
   const [workdetails,setworkdetails]=useState(null);
   const workdetailsselecting=(id)=>{
    setselecteddocument(null);
    setpersonaldetails(null);
    setemployementdetails(null);
    setActiveTab('address');
    setworkdetails(id);
    router.refresh();
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setexperiencedetails(null);
    seteducationdetails(null);
    setpafdocument(null);
    setfdnsdocument(null);
    setimmigrationdetails(null); 
    setError(null);
    router.refresh();
   }

const experiencedetailsselecting = (id) => {
  setselecteddocument(null);
  setpersonaldetails(null);
  setemployementdetails(null);
  setActiveTab('experience');
  setexperiencedetails(id);
  setworkdetails(null);
  setpafdocument(null);
  setfdnsdocument(null);
  setimmigrationdetails(null); 
  seteducationdetails(null);
  setEditingPersonal(false);
  setEditingEmployment(false);
  setEditingLeaves(false);
  setEditingWorkAddress(false);
  setEditingHomeAddress(false);
  setEditingEmergencyContact(false);
  setError(null);
  router.refresh();
};

const educationdetailsselecting = (id) => {
  setselecteddocument(null);
  setpersonaldetails(null);
  setemployementdetails(null);
  setActiveTab('education');
  setexperiencedetails(null);
  setworkdetails(null);
  seteducationdetails(id);
  router.refresh();
  setEditingPersonal(false);
  setpafdocument(null);
  setfdnsdocument(null);
  setimmigrationdetails(null); 
  setEditingEmployment(false);
  setEditingLeaves(false);
  setEditingWorkAddress(false);
  setEditingHomeAddress(false);
  setEditingEmergencyContact(false);
  setError(null);
  router.refresh();
};

const pafdocumentselecting = async (id) => {
  setselecteddocument(null);
  setpersonaldetails(null);
  setemployementdetails(null);
  setActiveTab('paf');
  setexperiencedetails(null);
  setworkdetails(null);
  seteducationdetails(null);
  router.refresh();
  setEditingPersonal(false);
  setpafdocument(id);
  setfdnsdocument(null);
  setimmigrationdetails(null); 
  setEditingEmployment(false);
  setEditingLeaves(false);
  setEditingWorkAddress(false);
  setEditingHomeAddress(false);
  setEditingEmergencyContact(false);
  setError(null);
  
  try {
    const pafDocs = await fetchPafDocumentsById(id);
    setPafDocuments(Array.isArray(pafDocs) ? pafDocs : []);
  } catch (err) {
    console.error('Error loading PAF documents:', err);
    setError('Failed to load PAF documents.');
  }
}

const fdnsdocumentselecting = async (id) => { 
  setselecteddocument(null);
  setpersonaldetails(null);
  setemployementdetails(null);
  setActiveTab('fdns');
  setexperiencedetails(null);
  setworkdetails(null);
  seteducationdetails(null);
  router.refresh();
  setEditingPersonal(false);
  setpafdocument(null);
  setfdnsdocument(id);
  setimmigrationdetails(null); 
  setEditingEmployment(false);
  setEditingLeaves(false);
  setEditingWorkAddress(false);
  setEditingHomeAddress(false);
  setEditingEmergencyContact(false);
  setError(null);
  
  try {
    const fdnsDocs = await fetchFdnsDocumentsById(id);
    setFdnsDocuments(Array.isArray(fdnsDocs) ? fdnsDocs : []);
  } catch (err) {
    console.error('Error loading FDNS documents:', err);
    setError('Failed to load FDNS documents.');
  }
}

const immigrationselecting = (id) => { 
  setselecteddocument(null);
  setpersonaldetails(null);
  setemployementdetails(null);
  setActiveTab('immigration');
  setexperiencedetails(null);
  setworkdetails(null);
  seteducationdetails(null);
  router.refresh();
  setEditingPersonal(false);
  setpafdocument(null);
  setfdnsdocument(null);
  setimmigrationdetails(id); 
  setEditingEmployment(false);
  setEditingLeaves(false);
  setEditingWorkAddress(false);
  setEditingHomeAddress(false);
  setEditingEmergencyContact(false);
  setError(null);
}

const handleProfilePhotoUpload = (e) => {
  setPhotoModalError(null); 
  if (e.target.files && e.target.files.length > 0) {
    const file = e.target.files[0];
    if (file.size > 1 * 1024 * 1024) {
      setPhotoModalError('File is too large. Please select an image under 1MB.');
      e.target.value = null;
      return;
    }
    setCrop(undefined);
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result?.toString() || '');
    });
    reader.readAsDataURL(file);
  }
};

const handleSaveCroppedPhoto = async () => {
    if (!imgRef.current || !crop || !crop.width || !crop.height) {
      setError('Please select an area to crop.');
      return;
    }
    setIsUploadingPhoto(true);
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = Math.floor(crop.width * scaleX);
    canvas.height = Math.floor(crop.height * scaleY);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    canvas.toBlob(async (blob) => {
      if (blob) {
        const formData = new FormData();
        formData.append('file', blob, `${employeeDetails.empid}.png`);
        formData.append('empId', employeeDetails.empid);
        try {
          await uploadProfilePhoto(formData);
          setImgSrc(`/uploads/profile_photos/${employeeDetails.empid}.png?${new Date().getTime()}`);
          setError(null);
          setIsPhotoModalOpen(false);
          setImageToCrop(null);
        } catch (err) {
          console.error('Error uploading profile photo:', err);
          setError('Failed to upload profile photo.');
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    }, 'image/png', 1);
};

const handleDeleteProfilePhoto = async (empId) => {
    if (!empId || imgSrc.includes("default.png")) return;
    try {
        await deleteProfilePhoto(empId);
        setImgSrc("/uploads/profile_photos/default.png");
        setError(null);
    } catch (err) {
        console.error('Error deleting profile photo:', err);
        setError('Failed to delete profile photo.');
    }
    setIsPhotoModalOpen(false);
    setImageToCrop(null);
};

const handleDeleteSignature = async () => {
  if (!employeeDetails?.empid) return;
  if (signatureFile) {
    setSignatureFile(null);
    return;
  }
  if (signatureSrc && !signatureSrc.includes('default')) {
    try {
      const result = await deleteSignature(employeeDetails.empid);
      if (result.success) {
        setSignatureSrc(null);
        setSignatureFile(null);
        setError(null);
      } else {
        setError(result.message || 'Failed to delete signature.');
      }
    } catch (err) {
      console.error('Error deleting signature:', err);
      setError('Failed to delete signature.');
    }
  }
};

function onImageLoad(e) {
  const { width, height } = e.currentTarget;
  const cropWidth = Math.min(width, height) * 0.9;
  setCrop({
    unit: 'px',
    x: (width - cropWidth) / 2,
    y: (height - cropWidth) / 2,
    width: cropWidth,
    height: cropWidth,
  });
}
  // ... (handleDocumentsUpdate, etc. omitted) ...
  const handleDocumentsUpdate = async () => {
    if (selectedEmpId) {
      try {
        const updatedDocuments = await fetchdocumentsbyid(selectedEmpId);
        setemployeedocuments(updatedDocuments);
        setError(null);
      } catch (err) {
        console.error('Error updating documents:', err);
        setError('Failed to refresh documents.');
      }
    }
  };
  
    const handlePafDocumentsUpdate = async () => {
    if (selectedEmpId) {
      try {
        const updatedDocuments = await fetchPafDocumentsById(selectedEmpId);
        setPafDocuments(updatedDocuments);
        setError(null);
      } catch (err) {
        console.error('Error updating PAF documents:', err);
        setError('Failed to refresh PAF documents.');
      }
    }
  };

  const handleFdnsDocumentsUpdate = async () => {
    if (selectedEmpId) {
      try {
        const updatedDocuments = await fetchFdnsDocumentsById(selectedEmpId);
        setFdnsDocuments(updatedDocuments);
        setError(null);
      } catch (err) {
        console.error('Error updating FDNS documents:', err);
        setError('Failed to refresh FDNS documents.');
      }
    }
  };

  const handleImmigrationUpdate = async () => {
    if (selectedEmpId) {
      try {
        const updatedImmigration = await fetchImmigrationData(selectedEmpId);
        setImmigrationData(updatedImmigration);
        setError(null);
      } catch (err) {
        console.error('Error updating immigration data:', err);
        setError('Failed to refresh immigration data.');
      }
    }
  };
  
  const handleExperienceUpdate = async () => {
    if (selectedEmpId) {
      try {
        const updatedExperience = await fetchExperienceByEmpId(selectedEmpId);
        setExperienceData(Array.isArray(updatedExperience) ? updatedExperience : []);
        setError(null);
      } catch (err) {
        console.error('Error updating experience data:', err);
        setError('Failed to refresh experience data.');
      }
    }
  };

  const handleEducationUpdate = async () => {
    if (selectedEmpId) {
      try {
        const updatedEducation = await fetchEducationByEmpId(selectedEmpId);
        setEducationData(Array.isArray(updatedEducation) ? updatedEducation : []);
        setError(null);
      } catch (err) {
        console.error('Error updating education data:', err);
        setError('Failed to refresh education data.');
      }
    }
  };

  const ensureOrgId = async () => {
    if (!formData.orgid || formData.orgid === '') {
      if (orgid) {
        setFormData(prev => ({ ...prev, orgid }));
        return orgid;
      }
      return null;
    }
    return formData.orgid;
  };

  const handleSave = async (section) => {
    // ... (Original logic omitted for brevity, keeping it same) ...
     setIsSaving(true);
  setSavingSection(section);
  const orgid = await ensureOrgId();
  if (!orgid) {
    setError('Organization ID is missing or invalid.');
    return;
  }
  const formDataToSubmit = new FormData();
  formDataToSubmit.append('empid', formData.empid);
  formDataToSubmit.append('orgid', orgid);
  formDataToSubmit.append('section', section);

  if (section === 'personal') {
    if (!formData.empFstName.trim()) { setError('First Name is required.'); return; }
    if (!formData.empLastName.trim()) { setError('Last Name is required.'); return; }
    if (!formData.email.trim()) { setError('Email is required.'); return; }
    formDataToSubmit.append('empFstName', formData.empFstName);
    formDataToSubmit.append('empMidName', formData.empMidName || '');
    formDataToSubmit.append('empLastName', formData.empLastName);
    formDataToSubmit.append('empPrefName', formData.empPrefName || '');
    formDataToSubmit.append('email', formData.email);
    formDataToSubmit.append('gender', formData.gender || '');
    formDataToSubmit.append('mobileNumber', formData.mobileNumber || '');
    formDataToSubmit.append('phoneNumber', formData.phoneNumber || '');
    formDataToSubmit.append('dob', formData.dob || '');
    formDataToSubmit.append('ssn', formData.ssn || '');
    formDataToSubmit.append('linkedinUrl', formData.linkedinUrl || '');
    formDataToSubmit.append('employee_number', formData.employee_number || '');
  } else if (section === 'employment') {
     if (selectedRoles.length === 0) { setError('At least one role is required.'); return; }
     if (!formData.hireDate) { setError('Hire Date is required.'); return; }
     if (!formData.status) { setError('Status is required.'); return; }
     
     if (!formData.suborgid) { setError('Organization is required.'); return; }

     selectedRoles.forEach((roleid) => formDataToSubmit.append('roleids', roleid));
     formDataToSubmit.append('hireDate', formData.hireDate || '');
     formDataToSubmit.append('lastWorkDate', formData.lastWorkDate || '');
     formDataToSubmit.append('terminatedDate', formData.terminatedDate || '');
     formDataToSubmit.append('rejoinDate', formData.rejoinDate || '');
     formDataToSubmit.append('superior', formData.superior || '');
     formDataToSubmit.append('status', formData.status || '');
     formDataToSubmit.append('jobTitle', formData.jobTitle || '');
     formDataToSubmit.append('payFrequency', formData.payFrequency || '');
     formDataToSubmit.append('deptId', formData.deptId || '');
     formDataToSubmit.append('deptName', formData.deptName || '');
     formDataToSubmit.append('workCompClass', formData.workCompClass || '');
     formDataToSubmit.append('suborgid', formData.suborgid || '');
     formDataToSubmit.append('employment_type', formData.employment_type || '');
     
     if (showVendorField && formData.vendor_id) {
       formDataToSubmit.append('vendor_id', formData.vendor_id);
     } else {
       formDataToSubmit.append('vendor_id', '');
     }
  } else if (section === 'leaves') {
    Object.entries(formLeaves).forEach(([leaveid, noofleaves]) => {
      if (noofleaves !== '' && noofleaves !== null && noofleaves !== undefined) {
        formDataToSubmit.append(`leaves[${leaveid}]`, noofleaves);
      }
    });
    if (Object.keys(formLeaves).length === 0) { setError('At least one leave assignment is required.'); return; }
  } else if (section === 'workAddress') {
     formDataToSubmit.append('workAddrLine1', formData.workAddrLine1 || '');
     formDataToSubmit.append('workAddrLine2', formData.workAddrLine2 || '');
     formDataToSubmit.append('workAddrLine3', formData.workAddrLine3 || '');
     formDataToSubmit.append('workCity', formData.workCity || '');
     formDataToSubmit.append('workStateId', formData.workStateId || '');
     formDataToSubmit.append('workStateNameCustom', formData.workStateNameCustom || '');
     formDataToSubmit.append('workCountryId', formData.workCountryId || '');
     formDataToSubmit.append('workPostalCode', formData.workPostalCode || '');
  } else if (section === 'homeAddress') {
     formDataToSubmit.append('homeAddrLine1', formData.homeAddrLine1 || '');
     formDataToSubmit.append('homeAddrLine2', formData.homeAddrLine2 || '');
     formDataToSubmit.append('homeAddrLine3', formData.homeAddrLine3 || '');
     formDataToSubmit.append('homeCity', formData.homeCity || '');
     formDataToSubmit.append('homeStateId', formData.homeStateId || '');
     formDataToSubmit.append('homeStateNameCustom', formData.homeStateNameCustom || '');
     formDataToSubmit.append('homeCountryId', formData.homeCountryId || '');
     formDataToSubmit.append('homePostalCode', formData.homePostalCode || '');
  } else if (section === 'emergencyContact') {
     formDataToSubmit.append('emergCnctName', formData.emergCnctName || '');
     formDataToSubmit.append('emergCnctPhoneNumber', formData.emergCnctPhoneNumber || '');
     formDataToSubmit.append('emergCnctEmail', formData.emergCnctEmail || '');
     formDataToSubmit.append('emergCnctAddrLine1', formData.emergCnctAddrLine1 || '');
     formDataToSubmit.append('emergCnctAddrLine2', formData.emergCnctAddrLine2 || '');
     formDataToSubmit.append('emergCnctAddrLine3', formData.emergCnctAddrLine3 || '');
     formDataToSubmit.append('emergCnctCity', formData.emergCnctCity || '');
     formDataToSubmit.append('emergCnctStateId', formData.emergCnctStateId || '');
     formDataToSubmit.append('emergCnctStateNameCustom', formData.emergCnctStateNameCustom || '');
     formDataToSubmit.append('emergCnctCountryId', formData.emergCnctCountryId || '');
     formDataToSubmit.append('emergCnctPostalCode', formData.emergCnctPostalCode || '');
  }

  try {
    const result = await updateEmployee({}, formDataToSubmit);
    if (result && typeof result === 'object' && result.success) {
      const updatedEmployee = await fetchEmployeeById(formData.empid);
      const updatedLeaveAssignments = await fetchLeaveAssignments(formData.empid);
      const updatedDocuments = await fetchdocumentsbyid(formData.empid);
      setEmployeeDetails(updatedEmployee);
      setLeaveAssignments(updatedLeaveAssignments);
      setemployeedocuments(updatedDocuments);
      setSelectedRoles(updatedEmployee.roleids || []);
      
     if (section === 'personal') {
        if (signatureFile) {
            try {
            const sigData = new FormData();
            sigData.append('file', signatureFile);
            sigData.append('empId', formData.empid);
            
            console.log('Uploading signature for empId:', formData.empid);
            const sigResult = await uploadSignature(sigData);
            console.log('Signature upload result:', sigResult);
            
            if (sigResult.success) {
                const newTimestamp = new Date().getTime();
                const newSignatureSrc = `/uploads/signatures/${formData.empid}.jpg?${newTimestamp}`;
                console.log('Setting new signature source:', newSignatureSrc);
                setSignatureSrc(newSignatureSrc);
                setSignatureFile(null);
            }
            } catch (sigErr) {
            console.error('Failed to upload signature:', sigErr);
            }
        }
        setEditingPersonal(false);  
    } 
      if (section === 'employment') {
        setEditingEmployment(false);
      }
      
      if (section === 'leaves') setEditingLeaves(false);
      if (section === 'workAddress') setEditingWorkAddress(false);
      if (section === 'homeAddress') setEditingHomeAddress(false);
      if (section === 'emergencyContact') setEditingEmergencyContact(false);
      setError(null);
      setIsSaving(false);
      setSavingSection(null);
    } else {
      const errorMessage = result && result.error ? result.error : 'Failed to save: Invalid response from server';
      setError(errorMessage);
      setIsSaving(false);
      setSavingSection(null);
    }
  } catch (err) {
    console.error(`Error saving ${section} details:`, err);
    setError(err.message || 'An unexpected error occurred while saving.');
    setIsSaving(false);
    setSavingSection(null);
  }
  };


  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'employment_type') {
      const selectedTypeId = value;
      if (selectedTypeId === '12' || selectedTypeId === '13') {
        setShowVendorField(true);
      } else {
        setShowVendorField(false);
        setFormData(prev => ({
          ...prev,
          employment_type: value,
          vendor_id: ''
        }));
        return;
      }
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCancelPersonal = () => {
    setEditingPersonal(false);
    setFormData(prev => ({
      ...prev,
      empFstName: employeeDetails.EMP_FST_NAME || '',
      empMidName: employeeDetails.EMP_MID_NAME || '',
      empLastName: employeeDetails.EMP_LAST_NAME || '',
      empPrefName: employeeDetails.EMP_PREF_NAME || '',
      email: employeeDetails.email || '',
      gender: employeeDetails.GENDER || '',
      mobileNumber: employeeDetails.MOBILE_NUMBER || '',
      phoneNumber: employeeDetails.PHONE_NUMBER || '',
      dob: employeeDetails.DOB || '',
      ssn: employeeDetails.SSN || '',
      linkedinUrl: employeeDetails.LINKEDIN_URL || '',
      employee_number: employeeDetails.employee_number || '',
    }));
    setSignatureSrc(`/uploads/signatures/${employeeDetails.empid}.jpg?${new Date().getTime()}`);
    setSignatureFile(null);
  };

  const handleCancelEmployment = () => {
    setEditingEmployment(false);
    setFormData(prev => ({
      ...prev,
      hireDate: employeeDetails.HIRE || '',
      lastWorkDate: employeeDetails.LAST_WORK_DATE || '',
      terminatedDate: employeeDetails.TERMINATED_DATE || '',
      rejoinDate: employeeDetails.REJOIN_DATE || '',
      superior: employeeDetails.superior || '',
      status: employeeDetails.STATUS || '',
      jobTitle: employeeDetails.JOB_TITLE || '',
      payFrequency: employeeDetails.PAY_FREQUENCY || '',
      deptId: employeeDetails.DEPT_ID !== null && employeeDetails.DEPT_ID !== undefined ? String(employeeDetails.DEPT_ID) : '',
      workCompClass: employeeDetails.WORK_COMP_CLASS || '',
      suborgid: employeeDetails.suborgid || '',
      employment_type: employeeDetails.employment_type || '',
      vendor_id: employeeDetails.vendor_id ? String(employeeDetails.vendor_id) : '',
    }));
    const empType = employeeDetails.employment_type ? String(employeeDetails.employment_type) : '';
    setShowVendorField(empType === '12' || empType === '13');
    setSelectedRoles(employeeDetails.roleids || []);
  };

  const handleCancelLeaves = () => {
    setEditingLeaves(false);
    setFormLeaves(leaveAssignments);
  };

  const handleCancelWorkAddress = () => {
    setEditingWorkAddress(false);
    setFormData(prev => ({
      ...prev,
      workAddrLine1: employeeDetails.WORK_ADDR_LINE1 || '',
      workAddrLine2: employeeDetails.WORK_ADDR_LINE2 || '',
      workAddrLine3: employeeDetails.WORK_ADDR_LINE3 || '',
      workCity: employeeDetails.WORK_CITY || '',
      workStateId: employeeDetails.WORK_STATE_ID ? String(employeeDetails.WORK_STATE_ID) : '',
      workStateNameCustom: employeeDetails.WORK_STATE_NAME_CUSTOM || '',
      workCountryId: employeeDetails.WORK_COUNTRY_ID ? String(employeeDetails.WORK_COUNTRY_ID) : '185',
      workPostalCode: employeeDetails.WORK_POSTAL_CODE || '',
    }));
  };

  const handleCancelHomeAddress = () => {
    setEditingHomeAddress(false);
    setFormData(prev => ({
      ...prev,
      homeAddrLine1: employeeDetails.HOME_ADDR_LINE1 || '',
      homeAddrLine2: employeeDetails.HOME_ADDR_LINE2 || '',
      homeAddrLine3: employeeDetails.HOME_ADDR_LINE3 || '',
      homeCity: employeeDetails.HOME_CITY || '',
      homeStateId: employeeDetails.HOME_STATE_ID ? String(employeeDetails.HOME_STATE_ID) : '',
      homeStateNameCustom: employeeDetails.HOME_STATE_NAME_CUSTOM || '',
      homeCountryId: employeeDetails.HOME_COUNTRY_ID ? String(employeeDetails.HOME_COUNTRY_ID) : '185',
      homePostalCode: employeeDetails.HOME_POSTAL_CODE || '',
    }));
  };

  const handleCancelEmergencyContact = () => {
    setEditingEmergencyContact(false);
    setFormData(prev => ({
      ...prev,
      emergCnctName: employeeDetails.EMERG_CNCT_NAME || '',
      emergCnctPhoneNumber: employeeDetails.EMERG_CNCT_PHONE_NUMBER || '',
      emergCnctEmail: employeeDetails.EMERG_CNCT_EMAIL || '',
      emergCnctAddrLine1: employeeDetails.EMERG_CNCT_ADDR_LINE1 || '',
      emergCnctAddrLine2: employeeDetails.EMERG_CNCT_ADDR_LINE2 || '',
      emergCnctAddrLine3: employeeDetails.EMERG_CNCT_ADDR_LINE3 || '',
      emergCnctCity: employeeDetails.EMERG_CNCT_CITY || '',
      emergCnctStateId: employeeDetails.EMERG_CNCT_STATE_ID ? String(employeeDetails.EMERG_CNCT_STATE_ID) : '',
      emergCnctStateNameCustom: employeeDetails.EMERG_CNCT_STATE_NAME_CUSTOM || '',
      emergCnctCountryId: employeeDetails.EMERG_CNCT_COUNTRY_ID ? String(employeeDetails.EMERG_CNCT_COUNTRY_ID) : '185',
      emergCnctPostalCode: employeeDetails.EMERG_CNCT_POSTAL_CODE || '',
    }));
  };

  // --- NEW HANDLERS FOR COPY FUNCTIONALITY ---
  const handleCopyHomeToWork = () => {
    setFormData(prev => ({
      ...prev,
      workAddrLine1: prev.homeAddrLine1,
      workAddrLine2: prev.homeAddrLine2,
      workAddrLine3: prev.homeAddrLine3,
      workCity: prev.homeCity,
      workStateId: prev.homeStateId,
      workStateNameCustom: prev.homeStateNameCustom,
      workCountryId: prev.homeCountryId,
      workPostalCode: prev.homePostalCode,
    }));
  };

  const handleCopyWorkToHome = () => {
    setFormData(prev => ({
      ...prev,
      homeAddrLine1: prev.workAddrLine1,
      homeAddrLine2: prev.workAddrLine2,
      homeAddrLine3: prev.workAddrLine3,
      homeCity: prev.workCity,
      homeStateId: prev.workStateId,
      homeStateNameCustom: prev.workStateNameCustom,
      homeCountryId: prev.workCountryId,
      homePostalCode: prev.workPostalCode,
    }));
  };

  // ... (getRoleNames, getSuperiorName, etc. omitted) ...
  const handleLeaveChange = (leaveid, value) => {
    setFormLeaves(prev => ({ ...prev, [leaveid]: value }));
  };
  
  const handleRoleToggle = (roleid) => {
    setSelectedRoles((prev) => {
      const newRoles = prev.includes(roleid)
        ? prev.filter((id) => id !== roleid)
        : [...prev, roleid];
      return [...new Set(newRoles)];
    });
  };

  const getRoleNames = (roleids) => {
    if (!roleids || roleids.length === 0) return 'No Roles';
    return roleids
      .map((roleid) => roles.find((r) => r.roleid === roleid)?.rolename || 'Unknown Role')
      .join(', ');
  };

  const getSuperiorName = (superiorId) => {
    const superior = allEmployees.find(emp => emp.empid === superiorId);
    return superior ? `${superior.EMP_FST_NAME} ${superior.EMP_LAST_NAME || ''}`.trim() : 'No Superior';
  };

  const getSuperiorEmail = (superiorId) => {
    const superior = allEmployees.find(emp => emp.empid === superiorId);
    return superior ? superior.email : '';
  };

  const getStatusName = (statusId) => {
    const status = statuses.find(s => s.Name === statusId);
    return status ? status.Name : 'No Status';
  };

  const getJobTitleName = (jobTitle) => {
    const job = jobTitles.find(j => j.job_title_id === jobTitle);
    return job ? `${job.job_title} (Level: ${job.level || 'N/A'}, Salary Range: $${job.min_salary || 'N/A'} - $${job.max_salary || 'N/A'})` : 'No Job Title';
  };

  const getSimpleJobTitle = (jobTitleId) => {
    const job = jobTitles.find(j => j.job_title_id === jobTitleId);
    return job ? job.job_title : jobTitleId;
  };

  const getPayFrequencyName = (payFrequencyId) => {
    const freq = payFrequencies.find(f => f.Name === payFrequencyId);
    return freq ? freq.Name : 'No Pay Frequency';
  };

  const getDepartmentName = (deptId) => {
    if (!deptId) return formData.deptName || 'No Department';
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : (formData.deptName || 'No Department');
  };

  const getWorkerCompClassName = (classCode) => {
    const compClass = workerCompClasses.find(c => c.class_code === classCode);
    return compClass ? `${compClass.class_code} - ${compClass.phraseology}` : 'No Worker Comp Class';
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.ID === countryId);
    return country ? country.VALUE : 'No Country';
  };

  const getStateName = (stateId) => {
    const state = states.find(s => s.ID === stateId);
    return state ? state.VALUE : 'No State';
  };
  const getSuborgName = (suborgid) => {
  const suborg = suborgs.find((s) => s.suborgid === suborgid);
  return suborg ? suborg.suborgname : '-';
};

  const getdisplayprojectid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

  const helpers = {
      getRoleNames, getSuperiorName, getStatusName, getJobTitleName, 
      getPayFrequencyName, getDepartmentName, getWorkerCompClassName, 
      getCountryName, getStateName, getSuborgName, getdisplayprojectid
  };

  if (!employeeDetails) return <div className="loading">Loading details...</div>;

  return (
    <div className="role-details-container">
            {/* ... (Photo modal code omitted for brevity) ... */}
              <div className="roledetails-header"> 
              </div>
              <div className="profile-photo">
                <button className="profile-photo-button" onClick={() => setIsPhotoModalOpen(true)}>
                  <Image
                    src={imgSrc || "/uploads/profile_photos/default.png"}
                    alt="Profile Photo"
                    width={75}
                    height={75}
                    onError={() => setImgSrc("/uploads/profile_photos/default.png")}
                    unoptimized={true} 
                  />
                </button>
                <p>{employeeDetails.EMP_FST_NAME} {employeeDetails.EMP_LAST_NAME}</p>
              </div>

              {isPhotoModalOpen && (
                <div className="photo-modal-overlay">
                  <div className="photo-modal-content">
                    <button className="modal-close-button" onClick={() => {
                      setIsPhotoModalOpen(false);
                      setImageToCrop(null); 
                      setPhotoModalError(null);
                    }}>
                      &times;
                    </button>

                    {imageToCrop ? (
                      <div className="cropper-container">
                        <h3>Crop Your Photo</h3>
                        <div className="cropper-image-wrapper">
                           <ReactCrop
                            crop={crop}
                            onChange={(pixelCrop) => setCrop(pixelCrop)} 
                            aspect={1}
                            minWidth={100}
                          >
                            <img ref={imgRef} alt="Crop me" src={imageToCrop} onLoad={onImageLoad} />
                          </ReactCrop>
                        </div> 
                       
                        <div className="modal-actions">
                          <button className="button save" onClick={handleSaveCroppedPhoto} disabled={isUploadingPhoto}>
                            {isUploadingPhoto ? 'Saving...' : 'Save Photo'}
                          </button>
                          <button className="button cancel" onClick={() => setImageToCrop(null)} disabled={isUploadingPhoto}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="cropper-container">
                        <h3>Profile Photo</h3>
                        <Image
                          src={imgSrc || "/uploads/profile_photos/default.png"}
                          alt="Profile Photo"
                          width={250}
                          height={250}
                          className="modal-square-image"
                          onError={() => setImgSrc("/uploads/profile_photos/default.png")}
                          unoptimized={true} 
                        />
                        {photoModalError && <p className="modal-error-message">{photoModalError}</p>}
                        <div className="modal-actions">
                          <input
                            type="file"
                            id="profilePhotoUpload"
                            style={{ display: 'none' }}
                            accept="image/png, image/jpeg"
                            onChange={handleProfilePhotoUpload}
                          />
                          <button
                            className="button"
                            onClick={() => document.getElementById('profilePhotoUpload').click()}
                          >
                            Update
                          </button>
                          <button
                            className="button cancel"
                            onClick={() => handleDeleteProfilePhoto(employeeDetails?.empid)}
                            disabled={!imgSrc || imgSrc.includes("default.png")}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="roledetails-header">                          
                <h2 className="title">Employee Details</h2>            
                <button className="back-button" onClick={onBack}></button>            
              </div>
              <div className="employee-submenu-bar">
                <button className={activeTab === 'personal' ? 'active' : ''} onClick={() => personaldetailsselecting(employeeDetails.empid)}>Personal Details</button>
                <button className={activeTab === 'employment' ? 'active' : ''} onClick={() => employementdetailselecting(employeeDetails.empid)}>Employment Details</button>
                <button className={activeTab === 'address' ? 'active' : ''} onClick={() => workdetailsselecting(employeeDetails.empid)}>Address Details</button>
                <button className={activeTab === 'experience' ? 'active' : ''} onClick={() => experiencedetailsselecting(employeeDetails.empid)}>Work Experience</button>
                <button className={activeTab === 'education' ? 'active' : ''} onClick={() => educationdetailsselecting(employeeDetails.empid)}>Education</button>
                <button className={activeTab === 'immigration' ? 'active' : ''} onClick={() => immigrationselecting(employeeDetails.empid)}>Immigration</button>
                <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => documentselecting(employeeDetails.empid)}>Documents</button>
                <button className={activeTab === 'paf' ? 'active' : ''} onClick={() => pafdocumentselecting(employeeDetails.empid)}>PAF Documents</button>
                <button className={activeTab === 'fdns' ? 'active' : ''} onClick={() => fdnsdocumentselecting(employeeDetails.empid)}>FDNS Documents</button>
             </div>
             <br />
             
            {selecteddocument&&!personaldetails&&!employementdetails&&!workdetails&&!pafdocument&&!fdnsdocument&&!immigrationdetails&&(
                 <EmplopyeeDocument id={employeeDetails.empid}
                 documents={employeedocuments}
                 onDocumentsUpdate={handleDocumentsUpdate}
                 document_types={document_types}
                 document_purposes={document_purposes}
                 document_subtypes={document_subtypes}/>
            )}

            {!employementdetails&&personaldetails&&!workdetails&&!pafdocument&&!fdnsdocument&&!immigrationdetails&&(
                <PersonalDetails 
                  editing={editingPersonal}
                  setEditing={setEditingPersonal}
                  onCancel={handleCancelPersonal}
                  formData={formData}
                  handleFormChange={handleFormChange}
                  onSave={handleSave}
                  employeeDetails={employeeDetails}
                  canEdit={canEdit('personal')}
                  getDisplayProjectId={getdisplayprojectid}
                  signatureSrc={signatureSrc}
                  onSignatureFileChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSignatureFile(e.target.files[0]);
                    }
                  }}
                  onDeleteSignature={handleDeleteSignature} 
                  isSaving={isSaving && savingSection === 'personal'}
                />
            )}
            
            {employementdetails&&!workdetails&&!pafdocument&&!fdnsdocument&&!immigrationdetails&&(
              <>
               <EmploymentDetails 
                 editing={editingEmployment}
                 setEditing={setEditingEmployment}
                 onCancel={handleCancelEmployment}
                 formData={formData}
                 handleFormChange={handleFormChange}
                 onSave={handleSave}
                 employeeDetails={employeeDetails}
                 roles={roles}
                 selectedRoles={selectedRoles}
                 handleRoleToggle={handleRoleToggle}
                 isDropdownOpen={isDropdownOpen}
                 setIsDropdownOpen={setIsDropdownOpen}
                 statuses={statuses}
                 jobTitles={jobTitles}
                 payFrequencies={payFrequencies}
                 departments={departments}
                 workerCompClasses={workerCompClasses}
                 allEmployees={allEmployees}
                 suborgs={suborgs}
                 employmentTypes={employmentTypes}
                 canEdit={canEdit('employment')}
                 helpers={helpers}
                 isSaving={isSaving && savingSection === 'employment'}
                 vendors={vendors}
                 showVendorField={showVendorField}
               />
                          
               <LeaveAssignments 
                 editing={editingLeaves}
                 setEditing={setEditingLeaves}
                 onCancel={handleCancelLeaves}
                 formLeaves={formLeaves}
                 handleLeaveChange={handleLeaveChange}
                 onSave={handleSave}
                 leaveAssignments={leaveAssignments}
                 leaveTypes={leaveTypes}
                 canEdit={canEdit('leaves')}
                 isSaving={isSaving && savingSection === 'leaves'}
               />
            </>       
            )}
            
            {workdetails&&!pafdocument&&!fdnsdocument&&!immigrationdetails&&(
             <>
               <WorkAddress 
                 editing={editingWorkAddress}
                 setEditing={setEditingWorkAddress}
                 onCancel={handleCancelWorkAddress}
                 formData={formData}
                 handleFormChange={handleFormChange}
                 onSave={handleSave}
                 employeeDetails={employeeDetails}
                 countries={countries}
                 states={states}
                 canEdit={canEdit('workAddress')}
                 helpers={helpers}
                 isSaving={isSaving && savingSection === 'workAddress'}
                 onCopyHomeAddress={handleCopyHomeToWork} // Passing Handler
               />
               <HomeAddress 
                 editing={editingHomeAddress}
                 setEditing={setEditingHomeAddress}
                 onCancel={handleCancelHomeAddress}
                 formData={formData}
                 handleFormChange={handleFormChange}
                 onSave={handleSave}
                 employeeDetails={employeeDetails}
                 countries={countries}
                 states={states}
                 canEdit={canEdit('homeAddress')}
                 helpers={helpers}
                 isSaving={isSaving && savingSection === 'homeAddress'}
                 onCopyWorkAddress={handleCopyWorkToHome} // Passing Handler
               />
               <EmergencyContact 
                 editing={editingEmergencyContact}
                 setEditing={setEditingEmergencyContact}
                 onCancel={handleCancelEmergencyContact}
                 formData={formData}
                 handleFormChange={handleFormChange}
                 onSave={handleSave}
                 employeeDetails={employeeDetails}
                 countries={countries}
                 states={states}
                 canEdit={canEdit('emergencyContact')}
                 helpers={helpers}
                 isSaving={isSaving && savingSection === 'emergencyContact'}
               />
            </>
            )}
            
            {/* ... (Other sections omitted for brevity) ... */}
            {experiencedetails && !workdetails && !employementdetails && !personaldetails && !educationdetails && !selecteddocument && !immigrationdetails&&(
              <EmployeeExperience 
                empid={employeeDetails.empid}
                countries={countries}
                employeeName={`${employeeDetails.EMP_FST_NAME} ${employeeDetails.EMP_LAST_NAME}`}
                organizationName={org_name}
                employeeDetails={employeeDetails}
                superiorName={getSuperiorName(employeeDetails.superior)}
                superiorEmail={getSuperiorEmail(employeeDetails.superior)}
                jobTitleName={getSimpleJobTitle(employeeDetails.JOB_TITLE)}
                canEdit={canEdit('personal')}
                experienceList={experienceData} 
                onUpdate={handleExperienceUpdate} 
              />
            )}
            {educationdetails && !workdetails && !employementdetails && !personaldetails && !experiencedetails && !selecteddocument && !immigrationdetails&&(
              <EmployeeEducation 
                empid={employeeDetails.empid}
                countries={countries}
                states={states}
                canEdit={canEdit('personal')}
                educationList={educationData} 
                onUpdate={handleEducationUpdate}
              />
            )}
            {pafdocument && !workdetails && !employementdetails && !personaldetails && !experiencedetails && !educationdetails && !selecteddocument && !immigrationdetails&&(
              <PAFDocument 
                id={employeeDetails.empid}
                documents={pafDocuments}
                onDocumentsUpdate={handlePafDocumentsUpdate}
                document_types={paf_document_types}
                document_purposes={paf_document_statuses} 
                document_subtypes={paf_document_subtypes}
              />
            )}
            {fdnsdocument && !workdetails && !employementdetails && !personaldetails && !experiencedetails && !educationdetails && !selecteddocument && !immigrationdetails&&(
              <FDNS_Document 
                id={employeeDetails.empid}
                documents={fdnsDocuments}
                onDocumentsUpdate={handleFdnsDocumentsUpdate}
                document_types={fdns_document_types}
                document_purposes={fdns_document_statuses} 
                document_subtypes={fdns_document_subtypes}
              />
            )}
            {immigrationdetails && !workdetails && !employementdetails && !personaldetails && !experiencedetails && !educationdetails && !selecteddocument && !pafdocument && !fdnsdocument&&(
              <Immigration 
                empid={employeeDetails.empid}
                immigrationData={immigrationData}
                immigrationStatuses={immigrationStatuses}
                documentTypes={immigrationDocTypes}       
                documentSubtypes={immigrationDocSubtypes} 
                onUpdate={handleImmigrationUpdate}
                employeeName={`${employeeDetails.EMP_FST_NAME} ${employeeDetails.EMP_LAST_NAME}`}
                suborgs={suborgs}
                employeeSuborgId={employeeDetails.suborgid} 
              />
            )}
    </div>
  );
};

export default EditEmployee;