redis = require 'redis'
socket = require 'socket'
json = require 'lunajson'
curl = require("cURL")
require 'src.redis_script_wrapper'
require 'src.elo'

local expire_key = 'game_expirations'

os.execute("lua src/app.lua &")
print("Milliseconds: " .. socket.gettime()*1000)

local game_server = os.getenv("SERVER_ADDR")

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
    local player_session = redis.call('HGETALL', 'player_session_'..sid1)
    local rival_session = redis.call('HGETALL', 'player_session_'..sid2)

    ratingA, ratingB = eloRating(player_session["rating"], rival_session["rating"], outcome)

    redis.call('MULTI')
    redis.call('HSET', 'player_session_'..player_session["sid"], 'rating', ratingA)
    redis.call('HSET', 'player_session_'..rival_session["sid"], 'rating', ratingB)
    redis.call('HSET', 'player_mapping_'..player_session["sid"], 'rating_delta', ratingA - player_session["rating"])
    redis.call('HSET', 'player_mapping_'..rival_session["sid"], 'rating_delta', ratingB - rival_session["rating"])
    redis.call('EXEC')
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
        local expiry_item = redis.call('ZRANGE', expire_key, 0, 100, 'WITHSCORES')
        for k, v in pairs(expiry_item) do
            if (k % 2 == 0) then
                local game_id = expiry_item[k-1]
                local end_time = expiry_item[k]
                local curr_time = socket.gettime()*1000
                if (curr_time >=  tonumber(end_time)) then
                    local deletion = redis.call('ZREM', expire_key, game_id)
                    if (deletion == 0) then
                        -- A move has been made just in time and we weren't fast enough to handle this timeout.
                        -- The move function should check that it's been made past the time and quit the game
                        print("A move has been made and we weren't fast enough to complete the removal operation")
                    else
                        print("Ending game "..game_id.." due to expiration at "..end_time)
                        local game_mapping = redis.call('HGETALL', 'game_mapping_'..game_id)
                        local fen = game_mapping['fen']
                        local splitted_fen = {}
                        for k in string.gmatch(fen, "%S+") do
                            table.insert(splitted_fen, k)
                        end
                        local turn = splitted_fen[2]
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

                        local move_count = redis.call('LLEN', 'game_moves_'..game_id)
                        local egi = {}
                        if (move_count == 1) then
                            print('Only first move made so aborting game')
                            local payload = { ["data"] = { ["sid"] = loser_sid } }
                            local encoded = json.encode( payload )
                            local response = call_api(game_server..':5000/abort', encoded)
                            print('response from abort call '..response)
                            decoded = json.decode(response)
                            egi = decoded["end_game_info"]
                        else
                            print('Multiple moves made to ending game with elo update')
                            rating_dict = update_ratings(winner_sid, loser_sid, winner, 1)
                            local payload = { ["winner"] = winner, ["message"] = turn.." ran out of time",
                                ["white_rating"] = rating_dict["white"]["rating"],
                                ["black_rating"] = rating_dict["black"]["rating"],
                                ["white_rating_delta"] = rating_dict["white"]["rating_delta"],
                                ["black_rating_delta"] = rating_dict["black"]["rating_delta"]
                            }
                            egi = payload
                        end
                        redis.call('MULTI')
                        redis.call('HMSET', 'game_endgame_'..game_id, egi)          -- setting endgame dict
                        redis.call('HSET', 'player_mapping_'..loser_sid, "time_remaining", 0) -- zeroing loser remaning time
                        redis.call('HSET', 'game_mapping_'..game_id, "status", 3) -- game ended
                        redis.call('EXEC')
                        local payload = { ["winner"] = winner_sid, ["loser"] = loser_sid, ["extra_data"] = egi }
                        local encoded = json.encode( payload )
                        local response = call_api(game_server..':5000/game_over', encoded)
                        print('response from game_over call '..response)
                    end
                end
            else
                socket.sleep(1)
            end
        end
    end
end

-- main function
while(true) do
    local success, err = pcall(worker)
    if not success then
        print('operator worker raised error, sleep and continue')
        print(err)
        socket.sleep(1)
    end
end