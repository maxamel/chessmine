local app = require 'milua'
local redis = require 'redis'

-- Basic example (Milua API: add_callback(method, path_pattern, callback))
-- Callback receives (params, query, headers, body)
app.add_callback(
    "GET",
    "/",
    function(params, query, headers)
        return "<h1>Welcome to the <i>handsome</i> server!</h1>", {
            ["Content-Type"] = "text/html"
        }
    end
)

-- Example capturing a path variable (Milua uses {name} in path)
app.add_callback(
    "GET",
    "/user/{username}",
    function(params, query, headers)
        local username = params.username
        local times = query and query.times or 1
        return "The user " .. username .. " is" .. (" very"):rep(tonumber(times) or 1) .. " handsome"
    end
)

-- Healthcheck for Docker HEALTHCHECK
app.add_callback(
    "GET",
    "/healthcheck",
    function(params, query, headers)
        return 'OK', { [":status"] = "200" }
    end
)

-- Hooking the server close event
app.shutdown_hook(function()
    -- cleaning up any external resource
end)

app.start()

