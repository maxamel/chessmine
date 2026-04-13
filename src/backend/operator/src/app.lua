redis = require 'redis'
socket = require 'socket'
json = require 'lunajson'
curl = require("cURL")
require 'src.elo'

local function log(msg)
    print(os.date("%Y-%m-%d %H:%M:%S") .. " " .. tostring(msg))
end

local expire_key = 'game_expirations'
local redis_addr = os.getenv("REDIS_ADDR") or 'localhost'
local redis_port = 6379
local redis_password = os.getenv("REDIS_PASSWORD")
local client
local max_attempts = 30
local attempt = 0
while attempt < max_attempts do
  local ok, err = pcall(function()
    client = redis.connect(redis_addr, redis_port)
  end)
  if ok and client then
    break
  end
  attempt = attempt + 1
  if attempt == max_attempts then
    error("could not connect to redis:" .. redis_port .. " after " .. max_attempts .. " attempts: " .. tostring(err))
  end
  log("Redis not ready, retrying in 2s (" .. attempt .. "/" .. max_attempts .. ")...")
  socket.sleep(2)
end
if redis_password then
  client:auth(redis_password)
end

os.execute("lua src/webserver.lua &")
log("Started")

local game_server = os.getenv("SERVER_ADDR") or 'localhost'

-- HTTP Post
function call_api(endpoint, data)
    local answer = {}
    c = curl.easy{
      url        = endpoint,
      post       = true,
      httpheader = {
        "Content-Type: application/json";
      };
      postfields = data;
    }

    c:perform({writefunction=function(str)
                   answer = str
              end
    })
    return answer
end

function update_ratings(sid1, sid2, winner_color, outcome)
    local player_session = client:hgetall('player_session_'..sid1)
    local rival_session = client:hgetall('player_session_'..sid2)

    ratingA, ratingB = eloRating(player_session["rating"], rival_session["rating"], outcome)

    client:pipeline( function(t)
        t:hset('player_session_'..player_session["sid"], 'rating', ratingA)
        t:hset('player_session_'..rival_session["sid"], 'rating', ratingB)
        t:hset('player_mapping_'..player_session["sid"], 'rating_delta', ratingA - player_session["rating"])
        t:hset('player_mapping_'..rival_session["sid"], 'rating_delta', ratingB - rival_session["rating"])
    end)
    local loser_color = 'black'
    if (winner_color == 'black') then
        loser_color = 'white'
    end
    local payload = { [winner_color] = { ["rating"] = ratingA, ["rating_delta"] = ratingA - player_session["rating"] },
                      [loser_color] = { ["rating"] = ratingB, ["rating_delta"] = ratingB - rival_session["rating"] } }
    return payload
end

function worker()
    while(true) do
        local expiry_item = client:zrange(expire_key, 0, 100, 'withscores')
        if next(expiry_item) ~= nil then
            for _, tab in pairs(expiry_item) do
                for k, v in pairs(tab) do
                    if (k % 2 == 0) then
                        local game_id = tab[k-1]
                        local end_time = v
                        local curr_time = socket.gettime()*1000
                        if (curr_time >=  tonumber(end_time)) then
                            local deletion = client:zrem(expire_key, game_id)
                            if (deletion == 0) then
                                -- A move has been made just in time and we weren't fast enough to handle this timeout.
                                -- The move function should check that it's been made past the time and quit the game
                                log("A move has been made and we weren't fast enough to complete the removal operation")
                            else
                                log("Ending game "..game_id.." due to expiration at "..end_time)
                                local game_mapping = client:hgetall('game_mapping_'..game_id)
                                local fen = game_mapping['fen']
                                local match_begin, match_end = string.find(fen, ' [w|b] ')
                                local turn = string.sub(fen, match_begin+1,match_end-1)
                                local winner = 'winner'
                                if (turn == 'w') then
                                    turn = 'white'
                                    winner = 'black'
                                else
                                    turn = 'black'
                                    winner = 'white'
                                end
                                local loser_sid = game_mapping[turn]
                                local winner_sid = game_mapping[winner]

                                local move_count = client:llen('game_moves_'..game_id)
                                local egi = {}
                                if (move_count == 1) then
                                    log('Only first move made so aborting game')
                                    local payload = { ["data"] = { ["sid"] = loser_sid } }
                                    local encoded = json.encode( payload )
                                    local response = call_api(game_server..':5000/abort', encoded)
                                    log('response from abort call: '..response)
                                    decoded = json.decode(response)
                                    egi = decoded["end_game_info"]
                                else
                                    log('Multiple moves made so ending game with elo update')
                                    rating_dict = update_ratings(winner_sid, loser_sid, winner, 1)
                                    local payload = { ["winner"] = winner, ["message"] = turn.." ran out of time",
                                        ["white_rating"] = rating_dict["white"]["rating"],
                                        ["black_rating"] = rating_dict["black"]["rating"],
                                        ["white_rating_delta"] = rating_dict["white"]["rating_delta"],
                                        ["black_rating_delta"] = rating_dict["black"]["rating_delta"]
                                    }
                                    egi = payload
                                end
                                client:pipeline( function(p)
                                    for key, val in pairs(egi) do
                                        p:hset('game_endgame_'..game_id, key, val)
                                    end
                                    p:hset('player_mapping_'..loser_sid, "time_remaining", "0")
                                    p:hset('game_mapping_'..game_id, "status", "3")
                                end)
                                local payload = { ["winner"] = winner_sid, ["loser"] = loser_sid, ["extra_data"] = egi }
                                local encoded = json.encode( payload )
                                local response = call_api(game_server..':5000/game_over', encoded)
                                log('response from game_over call: '..response)
                            end
                        end
                    end
                end
            end
        else
            socket.sleep(1)
        end
    end
end

-- main function
while(true) do
    local success, err = pcall(worker)
    if not success then
        log('operator worker raised error, sleep and continue')
        log(err)
        socket.sleep(1)
    end
end