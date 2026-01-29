import { useState } from "react";
import { Link } from "react-router";

interface Event {
  id: string;
  name: string;
  location: string;
  country: string;
  event_date: string;
}

interface EventPickerProps {
  events: Event[];
  onSelectEvent: (eventId: string) => void;
  defaultEventId?: string;
  hasError?: boolean;
}

export function EventPicker({ events, onSelectEvent, defaultEventId, hasError }: EventPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(() => {
    if (defaultEventId) {
      return events.find(e => e.id === defaultEventId) || null;
    }
    return null;
  });

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsOpen(false);
    onSelectEvent(event.id);
  };

  return (
    <div>
      {/* Hidden input for form submission */}
      <input type="hidden" name="eventId" value={selectedEvent?.id || ""} />

      {/* Trigger Button or Selected Event Display */}
      {!selectedEvent ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`input text-left text-gray-500 hover:border-brand-500 ${hasError ? "border-red-500 ring-1 ring-red-500" : ""}`}
        >
          Choose your event...
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Event: {selectedEvent.name}
              </p>
              <p className="text-xs text-gray-600">
                {selectedEvent.country} • {new Date(selectedEvent.event_date).getFullYear()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Change
          </button>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
              {/* Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Choose your event
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search by event name or country..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input"
                    autoFocus
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto px-6 py-4">
                {filteredEvents.length > 0 ? (
                  <div className="space-y-2">
                    {filteredEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => handleSelectEvent(event)}
                        className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
                      >
                        <p className="font-medium text-gray-900">{event.name}</p>
                        <p className="text-sm text-gray-600">
                          {event.country} • {new Date(event.event_date).getFullYear()}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Empty State */
                  <div className="py-12 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="mt-4 text-sm font-medium text-gray-900">
                      Can't find your event?
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      Contact us and we'll add it for you
                    </p>
                    <Link
                      to="/contact"
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent-500/30 hover:bg-accent-600 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Contact Us
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
