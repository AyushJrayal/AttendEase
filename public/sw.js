self.addEventListener("push", (event) => {

    let data = {};

    try {
        data = event.data.json();
    } catch (error) {
        data = { title: "AttendEase", body: "You have a new notification." };
    }

    const title = data.title || "AttendEase";

    const options = {
        body: data.body || "",
        icon: "/images/university-logo.jpg",
        badge: "/images/university-logo.jpg",
        data: {
            url: data.url || "/"
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );

});

self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const targetUrl = event.notification.data.url || "/";

    event.waitUntil(
        clients.matchAll({ type: "window" }).then((clientList) => {

            for (const client of clientList) {
                if (client.url.includes(targetUrl) && "focus" in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }

        })
    );

});