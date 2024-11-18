


function probability(rating1, rating2)
    return 1.0 * 1.0 / (1 + 1.0 * 10^(1.0 * (rating1 - rating2) / 400))
end


function eloRating(Ra, Rb, d)
    K = 20
    Pb = probability(Ra, Rb)
    Pa = probability(Rb, Ra)


    Old_Ra = Ra
    Old_Rb = Rb
    if (d == 1) then
        -- Ra wins
        Ra = Ra + K * (1 - Pa)
        Rb = Rb + K * (0 - Pb)
    elseif (d == 2) then
        -- Rb wins
        Ra = Ra + K * (0 - Pa)
        Rb = Rb + K * (1 - Pb)
    elseif (d == 0) then
        -- Draw
        Ra = Ra + K * (0.5 - Pa)
        Rb = Rb + K * (0.5 - Pb)
    end
    if (Old_Ra ~= Old_Rb) then
        if (math.abs(Ra-Old_Ra) < 1) then    -- difference smaller than 1
            if (Ra > Old_Ra) then
                Ra = Old_Ra + 1
            else
                Ra = Old_Ra - 1
            end
        end

        if (math.abs(Rb-Old_Rb) < 1) then    -- difference smaller than 1
            if (Rb > Old_Rb) then
                Rb = Old_Rb + 1
            else
                Rb = Old_Rb - 1
            end
        end
    end

    return math.floor(0.5+tonumber(Ra)), math.floor(0.5+tonumber(Rb))
end