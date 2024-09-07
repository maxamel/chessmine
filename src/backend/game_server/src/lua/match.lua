-- Should be called with arguments: sorted set name, lower bound rating, upper bound rating, player sid
-- Example of zrange command: ZRANGE search_pool_5 1400 1600 player_sid BYSCORE
local players = redis.call('ZRANGE', KEYS[1], KEYS[2], KEYS[3], 'BYSCORE')
local found_player = 0
if next(players) ~= nil then
    for _, v in pairs(players) do
      if v ~= KEYS[4] then
        -- found suitable opponent
        redis.call('ZREM', KEYS[1], KEYS[4])
        redis.call('ZREM', KEYS[1], v)
        -- redis.log(redis.LOG_WARNING, string.format("returning = %s", v))
        return v
      else
        -- found our own player
        found_player = 1
      end
    end
end

return found_player