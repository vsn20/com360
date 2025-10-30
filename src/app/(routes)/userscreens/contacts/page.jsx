import React from 'react';
import { getContactsInitialData } from '@/app/serverActions/Contacts/actions';
import Overview from '@/app/components/Contacts/Overview';

export default async function ContactsPage() {
  let initialData;
  try {
    initialData = await getContactsInitialData();
  } catch (error) {
    return (
      <div className="contact-overview-container">
        <h1 className="contact-title">Contacts</h1>
        <p className="contact-error-message">
          Error loading contacts: {error.message}
        </p>
      </div>
    );
  }

  return (
    <Overview
      initialContacts={initialData.contacts}
      accounts={initialData.accounts}
      suborgs={initialData.suborgs}
      countries={initialData.countries}
      states={initialData.states}
      orgid={initialData.orgid}
    />
  );
}